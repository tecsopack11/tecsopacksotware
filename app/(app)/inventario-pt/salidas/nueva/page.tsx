import { createClient } from "@/lib/supabase/server";
import { ProductoSalidaForm, type ProductStockLine } from "@/components/inventario-pt/producto-salida-form";

export const dynamic = "force-dynamic";

export default async function NuevaSalidaPTPage() {
  const supabase = await createClient();

  const [{ data: stock }, { data: products }, { data: locations }] = await Promise.all([
    supabase.from("v_product_stock").select("product_id, location_id, quantity").gt("quantity", 0),
    supabase.from("products").select("id, name, code, unit_of_measure"),
    supabase.from("locations").select("id, name").eq("active", true),
  ]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));

  const stockLines: ProductStockLine[] = (stock ?? [])
    .map((r) => {
      if (!r.product_id || !r.location_id) return null;
      const product = productById.get(r.product_id);
      const location = locationById.get(r.location_id);
      if (!product || !location) return null;
      const line: ProductStockLine = {
        key: `${r.product_id}-${r.location_id}`,
        product_id: r.product_id,
        from_location_id: r.location_id,
        quantity: Number(r.quantity),
        unit: product.unit_of_measure,
        label: `${product.name} — ${location.name}`,
      };
      return line;
    })
    .filter((l): l is ProductStockLine => l !== null);

  return <ProductoSalidaForm stockLines={stockLines} />;
}
