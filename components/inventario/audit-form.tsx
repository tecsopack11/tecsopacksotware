"use client";
import { useActionState, useState } from "react";
import { saveAudit } from "@/lib/actions/inventory-audits";
import type { AuditItem } from "@/lib/inventory/audits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function AuditForm({ date, id, items }: { date?: string; id?: string; items?: AuditItem[] }) {
  const [state, action, pending] = useActionState(saveAudit, {});
  const [values, setValues] = useState<Record<string, string>>({});
  return <form action={action} className="space-y-4">
    <input type="hidden" name="action" value={id ? "complete" : "start"} />
    <input type="hidden" name="date" value={date ?? ""} /><input type="hidden" name="id" value={id ?? ""} />
    {items && <><p className="text-sm text-muted-foreground">Cuente cada material en su ubicación, sumando sus lotes. Registre 0 si no hay existencias. Coordine el conteo sin movimientos desde el inicio. Guardar conserva la evidencia; los ajustes de inventario se registran por separado.</p><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-2">Material / ubicación</th><th className="p-2">Sistema al iniciar</th><th className="p-2">Conteo físico</th><th className="p-2">Diferencia</th><th className="p-2">Motivo</th></tr></thead><tbody>{items.map(item => {
      const raw = values[item.key] ?? "";
      const difference = raw === "" ? null : Math.round((Number(raw) - item.expected) * 1000) / 1000;
      return <tr key={item.key} className="border-t"><td className="p-2"><input type="hidden" name="key" value={item.key} /><div className="font-medium">{item.material}</div><div className="text-muted-foreground">{item.code} · {item.location}</div></td><td className="p-2">{item.expected.toLocaleString("es-CO")} {item.unit}</td><td className="p-2"><Input aria-label={`Conteo de ${item.material} en ${item.location}`} className="min-w-28" type="number" min="0" max="999999999" step="0.001" required name={`physical:${item.key}`} value={raw} onChange={e => setValues({ ...values, [item.key]: e.target.value })} /></td><td className={`p-2 ${difference ? "text-destructive" : ""}`}>{difference === null ? "Por contar" : difference === 0 ? "Cuadra" : `${difference < 0 ? "Faltante" : "Sobrante"}: ${Math.abs(difference).toLocaleString("es-CO")} ${item.unit}`}</td><td className="p-2"><Input className="min-w-56" aria-label={`Motivo de diferencia de ${item.material} en ${item.location}`} name={`reason:${item.key}`} maxLength={2000} required={difference !== null && difference !== 0} placeholder={difference ? "Explique la diferencia" : "Observación opcional"} /></td></tr>;
    })}</tbody></table></div></>}
    {state.error && <p role="alert" className="text-destructive">{state.error}</p>}
    {state.success && <p role="status" className="text-primary">{state.success}</p>}
    <Button disabled={pending} type="submit">{pending ? "Guardando…" : id ? "Finalizar y guardar conteo" : "Iniciar conteo físico"}</Button>
  </form>;
}
