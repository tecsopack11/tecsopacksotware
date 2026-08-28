import { createClient } from "@/lib/supabase/server";
import { SalidaForm, type StockLine } from "@/components/inventario/salida-form";

export const dynamic = "force-dynamic";

export default async function NuevaSalidaPage() {
  const supabase = await createClient();

  const [{ data: stock }, { data: materials }, { data: locations }, { data: lots }] =
    await Promise.all([
      supabase
        .from("v_inventory_stock")
        .select("material_id, lot_id, location_id, quantity")
        .gt("quantity", 0),
      supabase.from("materials").select("id, name, code, unit_of_measure"),
      supabase.from("locations").select("id, name").eq("active", true).order("name"),
      supabase.from("material_lots").select("id, lot_code"),
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
    <SalidaForm
      stockLines={stockLines}
      destinations={(locations ?? []).map((l) => ({ id: l.id, label: l.name }))}
    />
  );
}
