import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  code: string;
  unit_of_measure: string;
  min_stock: number;
};

function ProductCard({ product, total }: { product: ProductRow; total: number }) {
  const status =
    product.min_stock > 0 && total < product.min_stock
      ? "bajo"
      : product.min_stock > 0 && total < product.min_stock * 1.25
        ? "cerca"
        : "ok";
  return (
    <Card
      className={cn(
        "border-2",
        status === "bajo" && "border-destructive",
        status === "cerca" && "border-warning",
        status === "ok" && "border-transparent",
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{product.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold",
            status === "bajo" && "text-destructive",
            status === "cerca" && "text-warning",
          )}
        >
          {total.toLocaleString("es-CO")} {product.unit_of_measure}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Mínimo: {product.min_stock.toLocaleString("es-CO")} {product.unit_of_measure}
        </div>
        {status === "bajo" && (
          <Badge variant="destructive" className="mt-2">
            Pedir / fabricar
          </Badge>
        )}
        {status === "cerca" && (
          <Badge variant="outline" className="mt-2 border-warning text-warning">
            Cerca del mínimo
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default async function InventarioPTPage() {
  const supabase = await createClient();

  const [{ data: stock }, { data: products }, { data: locations }] = await Promise.all([
    supabase.from("v_product_stock").select("product_id, location_id, quantity"),
    supabase
      .from("products")
      .select("id, name, code, unit_of_measure, min_stock")
      .eq("active", true)
      .order("name"),
    supabase.from("locations").select("id, name").eq("type", "almacen_pt"),
  ]);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));

  const totalByProduct = new Map<string, number>();
  for (const row of stock ?? []) {
    if (!row.product_id) continue;
    totalByProduct.set(row.product_id, (totalByProduct.get(row.product_id) ?? 0) + Number(row.quantity));
  }

  const rows = (stock ?? [])
    .filter((row) => row.product_id && row.location_id)
    .map((row) => ({
      ...row,
      product: productById.get(row.product_id!),
      location: locationById.get(row.location_id!),
    }))
    .filter((r) => r.product && r.location)
    .sort((a, b) => a.product!.name.localeCompare(b.product!.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventario de producto terminado</h1>
          <p className="text-muted-foreground">Existencia actual por almacén.</p>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/inventario-pt/movimientos" />} nativeButton={false} variant="outline">
            Historial
          </Button>
          <Button render={<Link href="/inventario-pt/salidas/nueva" />} nativeButton={false} variant="outline">
            Salida
          </Button>
          <Button render={<Link href="/inventario-pt/entradas/nueva" />} nativeButton={false}>
            Nueva entrada
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {(products ?? []).map((p) => (
          <ProductCard key={p.id} product={p} total={totalByProduct.get(p.id) ?? 0} />
        ))}
        {(products ?? []).length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            Todavía no hay productos en el catálogo. Créalos desde Administración → Productos.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existencia por almacén</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Almacén</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Sin movimientos registrados todavía.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={`${row.location_id}-${row.product_id}`}>
                  <TableCell>{row.location!.name}</TableCell>
                  <TableCell>
                    {row.product!.name}{" "}
                    <span className="text-muted-foreground">({row.product!.code})</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(row.quantity).toLocaleString("es-CO")} {row.product!.unit_of_measure}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
