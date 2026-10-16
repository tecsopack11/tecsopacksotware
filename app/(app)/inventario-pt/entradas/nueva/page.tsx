import { createClient } from "@/lib/supabase/server";
import { ProductoEntradaForm } from "@/components/inventario-pt/producto-entrada-form";

export const dynamic = "force-dynamic";

export default async function NuevaEntradaPTPage({ searchParams }: {
  searchParams: Promise<{ product?: string; initial?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: products }, { data: locations }] = await Promise.all([
    supabase.from("products").select("id, name, code").eq("active", true).order("name"),
    supabase.from("locations").select("id, name").eq("active", true).eq("type", "almacen_pt").order("name"),
  ]);

  return (
    <ProductoEntradaForm
      products={(products ?? []).map((p) => ({ id: p.id, label: `${p.name} (${p.code})` }))}
      locations={(locations ?? []).map((l) => ({ id: l.id, label: l.name }))}
      defaultLocationId={locations?.[0]?.id}
      defaultProductId={products?.find((p) => p.id === params.product)?.id}
      initialInventory={params.initial === "1"}
    />
  );
}
