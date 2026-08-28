"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const POLL_INTERVAL_MS = 60_000;

export function StockAlerts() {
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const supabase = createClient();
    let cancelled = false;

    async function checkStock() {
      if (Notification.permission !== "granted") return;

      const [{ data: materials }, { data: stock }] = await Promise.all([
        supabase
          .from("materials")
          .select("id, name, unit_of_measure, min_stock")
          .eq("active", true)
          .gt("min_stock", 0),
        supabase.from("v_inventory_stock").select("material_id, quantity"),
      ]);

      if (cancelled || !materials) return;

      const totals = new Map<string, number>();
      for (const row of stock ?? []) {
        if (!row.material_id) continue;
        totals.set(row.material_id, (totals.get(row.material_id) ?? 0) + Number(row.quantity));
      }

      for (const material of materials) {
        const total = totals.get(material.id) ?? 0;
        const isBelow = total < material.min_stock;
        const alreadyNotified = notifiedRef.current.has(material.id);

        if (isBelow && !alreadyNotified) {
          notifiedRef.current.add(material.id);
          new Notification(`Tecsopack: ${material.name} bajo el mínimo`, {
            body: `Quedan ${total.toLocaleString("es-CO")} ${material.unit_of_measure} (mínimo ${material.min_stock.toLocaleString("es-CO")} ${material.unit_of_measure}). Considera pedir o comprar.`,
            tag: `stock-${material.id}`,
          });
        } else if (!isBelow && alreadyNotified) {
          notifiedRef.current.delete(material.id);
        }
      }
    }

    checkStock();
    const interval = setInterval(checkStock, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}
