import Link from "next/link";
import catalog from "@/lib/products/generic-catalog.json";
import { getProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { ImportGenericCatalog } from "@/components/inventario-pt/import-generic-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function GenericCatalogPage({ searchParams }: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const rows = catalog.filter((item) => (!category || item.category === category) &&
    normalize(`${item.reference} ${item.design} ${item.color} ${item.dimensions}`).includes(normalize(query)));
  const session = await getProfile();
  const supabase = await createClient();
  const [{ data: products, error }, { data: stock, error: stockError }] = await Promise.all([
    supabase.from("products").select("id, code, active, product_movements(count)")
      .in("code", catalog.map((item) => item.code)).is("product_movements.cancelled_at", null),
    supabase.from("v_product_stock").select("product_id, quantity"),
  ]);
  const registered = new Map((products ?? []).map((item) => [item.code, item]));
  const totals = new Map<string, number>();
  for (const row of stock ?? []) {
    if (row.product_id) totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + Number(row.quantity));
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CATÁLOGO DE PRODUCTO TERMINADO GENÉRICO</h1>
          <p className="text-muted-foreground">63 VARIANTES: 41 LÁMINAS Y 22 BOLSILLOS.</p>
        </div>
        <Button render={<Link href="/inventario-pt" />} nativeButton={false} variant="outline">VER INVENTARIO</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        FUENTE: LISTA DE GENERICO.xlsx. PAQUETE Y BULTO INDICAN UNIDADES POR PRESENTACIÓN; NO SON EXISTENCIAS NI PESOS EN KG.
      </p>
      <p className="text-sm text-muted-foreground">LAS EXISTENCIAS QUEDAN POR DILIGENCIAR HASTA QUE PLANTA REGISTRE EL INVENTARIO FÍSICO.</p>
      {session?.profile.active && session.profile.role === "admin" && <ImportGenericCatalog />}
      {(error || stockError) && <p role="alert" className="text-destructive">NO SE PUDO CONSULTAR EL ESTADO DEL INVENTARIO.</p>}
      <form className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">BUSCAR REFERENCIA, DISEÑO O COLOR
          <Input name="q" defaultValue={query} placeholder="L29, CUADROS, ROJO…" />
        </label>
        <label className="space-y-1 text-sm">FAMILIA
          <select name="category" defaultValue={category} className="block h-9 rounded-md border bg-background px-3">
            <option value="">TODAS</option><option>LÁMINAS</option><option>BOLSILLOS</option>
          </select>
        </label>
        <Button type="submit" variant="outline">FILTRAR</Button>
      </form>
      <p className="text-sm text-muted-foreground">{rows.length} VARIANTES</p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow>
            {["FAMILIA", "REFERENCIA", "DISEÑO", "COLOR", "DIMENSIONES", "CALIBRE", "UNDS/PAQUETE", "UNDS/BULTO", "EXISTENCIA (UNDS)", "CATÁLOGO"].map((label) => <TableHead key={label}>{label}</TableHead>)}
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((item) => {
              const product = registered.get(item.code);
              const hasMovements = (product?.product_movements[0]?.count ?? 0) > 0;
              return <TableRow key={item.code}>
              <TableCell>{item.category}</TableCell><TableCell>{item.reference}</TableCell>
              <TableCell>{item.design}</TableCell><TableCell>{item.color}</TableCell><TableCell>{item.dimensions}</TableCell>
              <TableCell>{item.gauge.toLocaleString("es-CO")}</TableCell>
              <TableCell>{item.unitsPerPack.toLocaleString("es-CO")}</TableCell><TableCell>{item.unitsPerBale.toLocaleString("es-CO")}</TableCell>
              <TableCell>{error || stockError ? "SIN CONSULTAR" : hasMovements && product ? (totals.get(product.id) ?? 0).toLocaleString("es-CO") : <div className="space-y-1">
                <span className="text-muted-foreground">POR DILIGENCIAR</span>
                {product?.active && <Link className="block underline" href={`/inventario-pt/entradas/nueva?product=${product.id}&initial=1`}>DILIGENCIAR</Link>}
              </div>}</TableCell>
              <TableCell>{error ? "SIN CONSULTAR" : product ? product.active ? "CARGADO" : "INACTIVO" : "PENDIENTE"}</TableCell>
            </TableRow>})}
            {rows.length === 0 && <TableRow><TableCell colSpan={10}>SIN RESULTADOS PARA ESTOS FILTROS.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
