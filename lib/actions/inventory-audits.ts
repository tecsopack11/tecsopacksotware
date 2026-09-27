"use server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import { revalidatePath } from "next/cache";
import { z } from "zod";
export async function saveAudit(_previous: { error?: string; success?: string }, form: FormData): Promise<{ error?: string; success?: string }> {
  const session = await getProfile();
  if (!session?.profile.active || !["admin", "supervisor"].includes(session.profile.role)) return { error: "No autorizado" };
  const db = await createClient();
  if (form.get("action") === "start") {
    const date = z.iso.date().safeParse(form.get("date"));
    if (!date.success) return { error: "Fecha inválida" };
    const { error } = await db.rpc("start_inventory_audit", { p_due_date: date.data });
    if (error) return { error: error.message };
  } else {
    const id = z.uuid().safeParse(form.get("id"));
    const counts = [];
    for (const key of form.getAll("key")) {
      const raw = form.get(`physical:${key}`);
      if (typeof raw !== "string" || !raw.trim()) return { error: "Complete todas las cantidades físicas" };
      const physical = Number(raw);
      if (!Number.isFinite(physical) || physical < 0) return { error: "Cantidad inválida" };
      counts.push({ key: String(key), physical, reason: String(form.get(`reason:${key}`) ?? "").trim() });
    }
    if (!id.success) return { error: "Auditoría inválida" };
    const { error } = await db.rpc("complete_inventory_audit", { p_id: id.data, p_counts: counts });
    if (error) return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { success: form.get("action") === "start" ? "Auditoría iniciada" : "Conteo guardado" };
}
export async function auditAlert() {
  const session = await getProfile();
  if (!session?.profile.active || !["admin", "supervisor"].includes(session.profile.role)) return { pending: 0 };
  const db = await createClient();
  const [{ data: schedule, error }, { data: audits, error: auditError }] = await Promise.all([
    db.from("inventory_audit_schedule").select("starts_on").single(),
    db.from("inventory_audits").select("due_date, completed_at"),
  ]);
  if (error || auditError) return { pending: 0, error: "No se pudieron consultar las auditorías" };
  const { auditFridays, caliDate } = await import("@/lib/inventory/audits");
  return { pending: auditFridays(schedule.starts_on, caliDate()).filter(date => !audits.some(a => a.due_date === date && a.completed_at)).length };
}
