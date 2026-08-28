import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LOCATION_TYPE_LABEL: Record<string, string> = {
  bodega: "Bodega",
  piso: "Piso",
  maquina: "Máquina",
  externo: "Externo",
  merma: "Merma",
};

export default async function InventarioPage() {
  const supabase = await createClient();

  const [{ data: stock }, { data: materials }, { data: locations }, { data: lots }] =
    await Promise.all([
      supabase.from("v_inventory_stock").select("material_id, lot_id, location_id, quantity"),
      supabase
        .from("materials")
        .select("id, name, code, unit_of_measure, min_stock")
        .eq("active", true)
        .order("name"),
      supabase.from("locations").select("id, name, type"),
      supabase.from("material_lots").select("id, lot_code"),
    ]);

  const materialById = new Map((materials ?? []).map((m) => [m.id, m]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));
  const lotById = new Map((lots ?? []).map((l) => [l.id, l]));

  // Total por material, sumado en TODAS las ubicaciones — base para las casillas
  // de arriba y para decidir si hay que pedir/comprar.
  const totalByMaterial = new Map<string, number>();
  for (const row of stock ?? []) {
    if (!row.material_id) continue;
    totalByMaterial.set(
      row.material_id,
      (totalByMaterial.get(row.material_id) ?? 0) + Number(row.quantity),
    );
  }

  const rows = (stock ?? [])
    .filter((row) => row.material_id && row.location_id)
    .map((row) => ({
      ...row,
      material: materialById.get(row.material_id!),
      location: locationById.get(row.location_id!),
      lot: row.lot_id ? lotById.get(row.lot_id) : undefined,
    }))
    .filter((r) => r.material && r.location);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inventario</h1>
          <p className="text-muted-foreground">Existencia actual por ubicación y lote.</p>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/inventario/movimientos" />} nativeButton={false} variant="outline">
            Historial
          </Button>
          <Button
            render={<Link href="/inventario/salidas-traslados/nueva" />}
            nativeButton={false}
            variant="outline"
          >
            Salida / Traslado
          </Button>
          <Button render={<Link href="/inventario/entradas/nueva" />} nativeButton={false}>
            Nueva entrada
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {(materials ?? []).map((m) => {
          const total = totalByMaterial.get(m.id) ?? 0;
          const status =
            m.min_stock > 0 && total < m.min_stock
              ? "bajo"
              : m.min_stock > 0 && total < m.min_stock * 1.25
                ? "cerca"
                : "ok";
          return (
            <Card
              key={m.id}
              className={cn(
                "border-2",
                status === "bajo" && "border-destructive",
                status === "cerca" && "border-warning",
                status === "ok" && "border-transparent",
              )}
            >
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">{m.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-semibold",
                    status === "bajo" && "text-destructive",
                    status === "cerca" && "text-warning",
                  )}
                >
                  {total.toLocaleString("es-CO")} {m.unit_of_measure}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Mínimo: {m.min_stock.toLocaleString("es-CO")} {m.unit_of_measure}
                </div>
                {status === "bajo" && (
                  <Badge variant="destructive" className="mt-2">
                    Pedir / comprar
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
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existencia por ubicación</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ubicación</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Sin movimientos registrados todavía.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={`${row.location_id}-${row.material_id}-${row.lot_id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {row.location!.name}
                      <Badge variant="outline">{LOCATION_TYPE_LABEL[row.location!.type]}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.material!.name}{" "}
                    <span className="text-muted-foreground">({row.material!.code})</span>
                  </TableCell>
                  <TableCell>{row.lot?.lot_code ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {Number(row.quantity).toLocaleString("es-CO")} {row.material!.unit_of_measure}
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
