import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalidaForm, type StockLine } from "@/components/inventario/salida-form";
import { ConfirmReceiptButton } from "@/components/inventario/confirm-receipt-button";

export const dynamic = "force-dynamic";

const MOVEMENT_LABEL: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  traslado: "Traslado",
  consumo: "Consumo",
  ajuste: "Ajuste",
};

export default async function PlantaPage() {
  const supabase = await createClient();
  const session = await getProfile();
  const userId = session?.userId;

  const [{ data: stock }, { data: materials }, { data: locations }, { data: lots }, { data: pending }, { data: recent }] =
    await Promise.all([
      supabase.from("v_inventory_stock").select("material_id, lot_id, location_id, quantity").gt("quantity", 0),
      supabase.from("materials").select("id, name, code, unit_of_measure"),
      supabase.from("locations").select("id, name").eq("active", true).order("name"),
      supabase.from("material_lots").select("id, lot_code"),
      supabase
        .from("inventory_movements")
        .select(
          "id, quantity, created_at, materials(name, unit_of_measure), from:from_location_id(name), to:to_location_id(name), profiles!inventory_movements_created_by_fkey(full_name)",
        )
        .eq("movement_type", "traslado")
        .is("cancelled_at", null)
        .is("received_at", null)
        .order("created_at", { ascending: false }),
      userId
        ? supabase
            .from("inventory_movements")
            .select(
              "id, movement_type, quantity, created_at, cancelled_at, received_at, materials(name, unit_of_measure), from:from_location_id(name), to:to_location_id(name)",
            )
            .eq("created_by", userId)
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  const materialById = new Map((materials ?? []).map((m) => [m.id, m]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));
  const lotById = new Map((lots ?? []).map((l) => [l.id, l]));

  const stockLines: StockLine[] = (stock ?? [])
    .map((r) => {
      if (!r.material_id || !r.location_id) return null;
      const material = materialById.get(r.material_id);
      const location = locationById.get(r.location_id);
      const lot = r.lot_id ? lotById.get(r.lot_id) : undefined;
      if (!material || !location) return null;
      const line: StockLine = {
        key: `${r.material_id}-${r.lot_id}-${r.location_id}`,
        material_id: r.material_id,
        lot_id: r.lot_id,
        from_location_id: r.location_id,
        quantity: Number(r.quantity),
        unit: material.unit_of_measure,
        label: `${material.name} — ${lot?.lot_code ?? "sin lote"} — ${location.name}`,
      };
      return line;
    })
    .filter((l): l is StockLine => l !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Planta</h1>
        <p className="text-muted-foreground">Traslados internos y recepciones de materia prima.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recepciones pendientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(pending ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No hay traslados esperando confirmación.</p>
          )}
          {(pending ?? []).map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-2 rounded-md border border-warning/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <div className="font-medium">
                  {m.materials?.name} — {Number(m.quantity).toLocaleString("es-CO")} {m.materials?.unit_of_measure}
                </div>
                <div className="text-muted-foreground">
                  {m.from?.name ?? "—"} → {m.to?.name ?? "—"} · Enviado por {m.profiles?.full_name || "—"}
                </div>
              </div>
              <ConfirmReceiptButton movementId={m.id} />
            </div>
          ))}
        </CardContent>
      </Card>

      <SalidaForm
        stockLines={stockLines}
        destinations={(locations ?? []).map((l) => ({ id: l.id, label: l.name }))}
        redirectTo="/planta"
      />

      <Card>
        <CardHeader>
          <CardTitle>Tus movimientos recientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(recent ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no has registrado movimientos.</p>
          )}
          {(recent ?? []).map((m) => (
            <div key={m.id} className="flex flex-col gap-1 border-b border-border pb-2 text-sm last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{MOVEMENT_LABEL[m.movement_type]}</span>
                <span>{m.materials?.name}</span>
                <span className="text-muted-foreground">
                  {Number(m.quantity).toLocaleString("es-CO")} {m.materials?.unit_of_measure}
                </span>
                {m.cancelled_at ? (
                  <Badge variant="destructive">Cancelado</Badge>
                ) : m.movement_type === "traslado" && !m.received_at ? (
                  <Badge variant="outline" className="border-warning text-warning">
                    Pendiente de recepción
                  </Badge>
                ) : (
                  <Badge variant="secondary">Activo</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {m.from?.name ?? "—"} → {m.to?.name ?? "—"} ·{" "}
                {new Date(m.created_at).toLocaleString("es-CL")}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
