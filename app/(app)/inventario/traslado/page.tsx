import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SalidaForm, type StockLine } from "@/components/inventario/salida-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TrasladoPage() {
  const supabase = await createClient();
  const results = await Promise.all([
    supabase.from("v_inventory_stock").select("material_id, lot_id, location_id, quantity").gt("quantity", 0),
    supabase.from("materials").select("id, name, code, unit_of_measure").eq("active", true),
    supabase.from("locations").select("id, name, type").eq("active", true).in("type", ["bodega", "maquina"]).order("name"),
    supabase.from("material_lots").select("id, lot_code"),
  ]);
  if (results.some((result) => result.error)) return <p className="text-destructive">No se pudieron cargar las existencias. Recarga para intentar de nuevo.</p>;
  const [{ data: stock }, { data: materials }, { data: locations }, { data: lots }] = results;
  const materialById = new Map((materials ?? []).map((m) => [m.id, m]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));
  const lotById = new Map((lots ?? []).map((l) => [l.id, l]));

  const stockLines: StockLine[] = (stock ?? [])
    .map((r) => {
      if (!r.material_id || !r.location_id) return null;
      const material = materialById.get(r.material_id);
      const location = locationById.get(r.location_id);
      const lot = r.lot_id ? lotById.get(r.lot_id) : undefined;
      if (!material || !location || location.type !== "bodega") return null;
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

  const destinations = (locations ?? []).filter((location) => location.type === "maquina");
  return <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-semibold">Traslado</h1>
      <p className="text-muted-foreground">Selecciona la materia prima, la máquina y la cantidad que vas a enviar.</p>
      <p className="mt-2 text-sm text-muted-foreground">Se descuenta de bodega al enviar. La máquina recibe el saldo cuando se confirma la recepción en Planta.</p>
    </div>
    <Button render={<Link href="/inventario/registro" />} nativeButton={false} variant="outline">Volver al registro</Button>
    {stockLines.length === 0 ? <p>No hay materia prima disponible en bodega.</p> : destinations.length === 0 ? <p>Agrega una máquina en Ubicaciones para realizar el traslado.</p> : <SalidaForm transferOnly stockLines={stockLines} destinations={destinations.map((location) => ({ id: location.id, label: location.name }))} />}
  </div>;
}
