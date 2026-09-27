"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CALI_TIME_ZONE } from "@/lib/inventory/audits";
import { auditAlert } from "@/lib/actions/inventory-audits";
export function CaliClock({ canAudit }: { canAudit: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const [alert, setAlert] = useState<{ pending: number; error?: string }>({ pending: 0 });
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!canAudit) return;
    let active = true;
    const refresh = async () => {
      try { const result = await auditAlert(); if (active) setAlert(result); }
      catch { if (active) setAlert({ pending: 0, error: "No se pudieron consultar las auditorías" }); }
    };
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [canAudit]);
  return <div className="text-xs sm:text-sm">
    <div className="font-medium">Cali, Colombia · {now ? now.toLocaleTimeString("es-CO", { timeZone: CALI_TIME_ZONE, hour12: false }) : "—"}</div>
    <div className="text-muted-foreground">{now ? now.toLocaleDateString("es-CO", { timeZone: CALI_TIME_ZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Hora de Colombia (UTC−5)"}</div>
    {canAudit && <Link href="/inventario/auditorias" className={alert.pending || alert.error ? "font-medium text-destructive" : "text-primary"}>{alert.error ?? (alert.pending ? `${alert.pending} auditoría(s) pendiente(s) · Ver calendario` : "Auditorías de los viernes · Ver calendario")}</Link>}
  </div>;
}
