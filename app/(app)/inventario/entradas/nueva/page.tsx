import { createClient } from "@/lib/supabase/server";
import { EntradaForm } from "@/components/inventario/entrada-form";

export const dynamic = "force-dynamic";

export default async function NuevaEntradaPage() {
  const supabase = await createClient();

  const [{ data: materials }, { data: locations }] = await Promise.all([
    supabase.from("materials").select("id, name, code").eq("active", true).order("name"),
    supabase
      .from("locations")
      .select("id, name, type")
      .eq("active", true)
      .in("type", ["bodega", "piso"])
      .order("name"),
  ]);

  const bodega = locations?.find((l) => l.type === "bodega");

  return (
    <EntradaForm
      materials={(materials ?? []).map((m) => ({ id: m.id, label: `${m.name} (${m.code})` }))}
      locations={(locations ?? []).map((l) => ({ id: l.id, label: l.name }))}
      defaultLocationId={bodega?.id}
    />
  );
}
