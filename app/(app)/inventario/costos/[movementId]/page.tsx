import Link from "next/link";
import { notFound } from "next/navigation";
import { getCostSnapshot } from "@/lib/costs/data";
import { createClient } from "@/lib/supabase/server";
import { bogotaDate } from "@/lib/costs/schema";
import { formatCop } from "@/lib/costs/calculations";
import { CostForm } from "@/components/costos/cost-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export default async function CostEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ movementId: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { movementId } = await params;
  const { snapshot, error } = await getCostSnapshot();
  if (!snapshot)
    return (
      <p role="alert" className="text-destructive">
        {error}
      </p>
    );
  const movement = snapshot.movements.find((m) => m.id === movementId);
  if (!movement || movement.movement_type !== "entrada") notFound();
  const material = snapshot.materials.find(
    (m) => m.id === movement.material_id,
  );
  const current = snapshot.costs.find((c) => c.movement_id === movementId);
  const supabase = await createClient();
  const { data: history, error: historyError } = await supabase
    .from("material_cost_revisions")
    .select("*")
    .eq("movement_id", movementId)
    .order("revision", { ascending: false });
  const { data: authors } = await supabase
    .from("profiles")
    .select("id,full_name")
    .in("id", [...new Set((history ?? []).map((h) => h.created_by))]);
  const names = new Map((authors ?? []).map((a) => [a.id, a.full_name]));
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/inventario/costos"
        className="text-sm text-primary underline"
      >
        Volver a costos de MP
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Costo de {material?.name}</h1>
        <p className="text-muted-foreground">
          Entrada de {movement.quantity.toLocaleString("es-CO")}{" "}
          {material?.unit_of_measure} ·{" "}
          {movement.reference_doc ?? "Sin documento"}
        </p>
      </div>
      {(await searchParams).guardado && (
        <p
          role="status"
          className="rounded-md border border-primary/30 bg-accent p-3"
        >
          Costo guardado. Los promedios y la valoración ya incluyen esta
          versión.
        </p>
      )}
      {movement.cancelled_at ? (
        <p className="text-destructive">
          Esta entrada está cancelada y no participa en los costos.
        </p>
      ) : (
        <CostForm
          movementId={movement.id}
          quantity={movement.quantity}
          unit={material?.unit_of_measure}
          current={current}
          today={bogotaDate()}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Historial de costos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyError && (
            <p role="alert">
              No se pudo consultar el historial. Vuelve a intentar.
            </p>
          )}
          {!historyError && !history?.length && (
            <p className="text-muted-foreground">
              Esta entrada todavía no tiene precio.
            </p>
          )}
          {(history ?? []).map((h) => (
            <details key={h.id} className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm">
                Versión {h.revision} · {formatCop(h.total_cop)} ·{" "}
                {h.status === "confirmed" ? "Confirmado" : "Provisional"} ·{" "}
                {new Date(h.created_at).toLocaleString("es-CO", {
                  timeZone: "America/Bogota",
                })}
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <p>{h.reason}</p>
                <p>Responsable: {names.get(h.created_by) || h.created_by}</p>
                <p>
                  {h.supplier} · {h.invoice} · {h.shipment || "Sin contenedor"}
                </p>
                <p>
                  Precio: {h.unit_price} {h.currency} /{" "}
                  {material?.unit_of_measure} · Tasa: {h.exchange_rate} ·
                  Descuento: {h.discount} {h.currency}
                </p>
                <p>
                  Flete: {formatCop(h.freight)} · Seguro:{" "}
                  {formatCop(h.insurance)} · Impuestos no recuperables:{" "}
                  {formatCop(h.duties)} · Otros: {formatCop(h.other_costs)}
                </p>
                <p>
                  Impuestos recuperables excluidos:{" "}
                  {formatCop(h.recoverable_tax)}
                </p>
                <p>{h.allocation_note}</p>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
