import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { auditFridays, caliDate, CALI_TIME_ZONE, type AuditItem } from "@/lib/inventory/audits";
import { AuditForm } from "@/components/inventario/audit-form";
export const dynamic = "force-dynamic";
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CO", { timeZone: CALI_TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
export default async function AuditsPage() {
  const session = await getProfile();
  if (!session?.profile.active || !["admin", "supervisor"].includes(session.profile.role)) redirect("/");
  const db = await createClient();
  const [{ data: schedule, error }, { data: audits, error: auditError }] = await Promise.all([
    db.from("inventory_audit_schedule").select("starts_on").single(),
    db.from("inventory_audits").select("*").order("due_date", { ascending: false }),
  ]);
  if (error || auditError) return <div role="alert">No se pudieron cargar las auditorías. Verifique que la actualización de auditorías esté instalada y vuelva a intentar.</div>;
  const today = caliDate();
  const until = new Date(`${today}T12:00:00Z`); until.setUTCDate(until.getUTCDate() + 28);
  const dates = auditFridays(schedule.starts_on, until.toISOString().slice(0, 10));
  const pending = dates.filter(date => date <= today && !audits.some(a => a.due_date === date && a.completed_at));
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Auditorías de materia prima</h1><p className="text-muted-foreground">Conteo físico todos los viernes · Bodega y proceso productivo · Cali, Colombia (UTC−5)</p></div>
    <div className={`rounded-xl border p-4 ${pending.length ? "border-destructive" : ""}`} role="status">{pending.length ? `${pending.length} auditoría(s) pendiente(s). Los conteos vencidos permanecen pendientes hasta registrarlos.` : "No hay conteos pendientes."}</div>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Calendario de conteos</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{dates.map(date => {
      const audit = audits.find(a => a.due_date === date);
      return <a key={date} href={`#audit-${date}`} className="rounded-xl border bg-card p-4"><div className="font-medium">Viernes {dateLabel(date)}</div><div className={date <= today && !audit?.completed_at ? "text-destructive" : "text-muted-foreground"}>{audit?.completed_at ? "Completada" : audit ? "En conteo" : date > today ? "Programada" : date === today ? "Pendiente hoy" : "Vencida"}</div></a>;
    })}</div></section>
    {dates.filter(date => date <= today).reverse().map(date => {
      const audit = audits.find(a => a.due_date === date);
      const items = audit?.items as AuditItem[] | undefined;
      return <section id={`audit-${date}`} key={date} className="space-y-4 rounded-xl border bg-card p-4"><h2 className="text-lg font-semibold">Conteo del viernes {dateLabel(date)}</h2>
        {audit && <p className="text-sm text-muted-foreground">{audit.completed_at ? "Realizado" : "Iniciado"} por {audit.responsible} · {new Date(audit.completed_at ?? audit.started_at).toLocaleString("es-CO", { timeZone: CALI_TIME_ZONE })} · Referencia del sistema: {new Date(audit.started_at).toLocaleString("es-CO", { timeZone: CALI_TIME_ZONE })}</p>}
        {audit?.completed_at ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Material / ubicación</th><th className="p-2">Sistema</th><th className="p-2">Físico</th><th className="p-2">Resultado</th><th className="p-2">Motivo</th></tr></thead><tbody>{items?.map(item => <tr key={item.key} className="border-t"><td className="p-2">{item.material} · {item.location}</td><td className="p-2">{item.expected} {item.unit}</td><td className="p-2">{item.physical} {item.unit}</td><td className={`p-2 ${item.difference ? "text-destructive" : "text-primary"}`}>{!item.difference ? "Cuadra" : `${item.difference < 0 ? "Faltante" : "Sobrante"}: ${Math.abs(item.difference)} ${item.unit}`}</td><td className="p-2">{item.reason || "—"}</td></tr>)}</tbody></table></div> : <AuditForm key={audit?.id ?? date} date={date} id={audit?.id} items={items} />}
      </section>;
    })}
  </div>;
}
