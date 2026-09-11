import { createClient } from "@/lib/supabase/server";
import { RegistroDiarioForm } from "@/components/inventario/registro-diario-form";

export const dynamic = "force-dynamic";

export default async function RegistroInventarioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: materials }, { data: locations }, { data: stockRows }, { data: profile }] = await Promise.all([
    supabase.from("materials").select("id, name, code, unit_of_measure, category").eq("active", true).order("name"),
    supabase.from("locations").select("id, name, type").eq("active", true).in("type", ["bodega", "piso"]).order("name"),
    supabase.from("v_inventory_stock").select("material_id, location_id, quantity"),
    user ? supabase.from("profiles").select("full_name").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const stock: Record<string, Record<string, number>> = {};
  for (const row of stockRows ?? []) {
    if (!row.location_id || !row.material_id) continue;
    stock[row.location_id] ??= {};
    stock[row.location_id][row.material_id] = (stock[row.location_id][row.material_id] ?? 0) + Number(row.quantity);
  }

  const defaultLocation = locations?.find((location) => location.type === "bodega") ?? locations?.[0];

  if (!defaultLocation) {
    return <p className="text-destructive">Debes crear una ubicación de bodega o piso antes de registrar inventario.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Registro rápido de materia prima</h1>
        <p className="text-muted-foreground">Digita únicamente las entradas y salidas del día. Los totales se calculan automáticamente.</p>
      </div>
      <RegistroDiarioForm
        materials={(materials ?? []).map((material) => ({
          id: material.id,
          name: material.name,
          code: material.code,
          unit: material.unit_of_measure,
          category: material.category,
        }))}
        locations={(locations ?? []).map((location) => ({ id: location.id, name: location.name }))}
        stock={stock}
        defaultLocationId={defaultLocation.id}
        defaultResponsible={profile?.full_name ?? ""}
      />
    </div>
  );
}
