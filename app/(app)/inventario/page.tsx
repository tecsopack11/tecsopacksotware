import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/types/database.types";

export const dynamic = "force-dynamic";

const LOCATION_TYPE_LABEL: Record<string, string> = {
  bodega: "Bodega",
  piso: "Piso",
  maquina: "Máquina",
  externo: "Externo",
  merma: "Merma",
};

const LOCATION_TYPE_ORDER = ["bodega", "piso", "maquina", "externo", "merma"];

function isLocationType(value: string): boolean {
  return LOCATION_TYPE_ORDER.includes(value);
}

type MaterialCategory = Database["public"]["Enums"]["material_category"];

const CATEGORY_ORDER: MaterialCategory[] = ["principal", "pigmento", "tinta", "solvente"];
const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  principal: "Principales",
  pigmento: "Pigmentos",
  tinta: "Tintas",
  solvente: "Solventes",
};

// Orden explícito pedido para los materiales principales; cualquier otro
// material "principal" que se agregue después cae al final, alfabético.
const PRINCIPAL_ORDER = ["PEAD-01", "CARB-01", "BIO-01", "LINEAL-01", "PEBD-01", "REC-BEIGE", "REC-BLANCO"];

type MaterialRow = {
  id: string;
  name: string;
  code: string;
  unit_of_measure: string;
  min_stock: number;
  category: MaterialCategory;
};

function MaterialCard({ material, total }: { material: MaterialRow; total: number }) {
  const status =
    material.min_stock > 0 && total < material.min_stock
      ? "bajo"
      : material.min_stock > 0 && total < material.min_stock * 1.25
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
        <CardTitle className="text-sm font-medium text-muted-foreground">{material.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold",
            status === "bajo" && "text-destructive",
            status === "cerca" && "text-warning",
          )}
        >
          {total.toLocaleString("es-CO")} {material.unit_of_measure}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Mínimo: {material.min_stock.toLocaleString("es-CO")} {material.unit_of_measure}
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
}

function isMaterialCategory(value: string): value is MaterialCategory {
  return (CATEGORY_ORDER as string[]).includes(value);
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; ubicacion?: string }>;
}) {
  const { categoria, ubicacion } = await searchParams;
  const activeCategory = categoria && isMaterialCategory(categoria) ? categoria : null;
  const activeLocationType = ubicacion && isLocationType(ubicacion) ? ubicacion : null;

  const supabase = await createClient();

  const [{ data: stock }, { data: materials }, { data: locations }, { data: lots }] =
    await Promise.all([
      supabase.from("v_inventory_stock").select("material_id, lot_id, location_id, quantity"),
      supabase
        .from("materials")
        .select("id, name, code, unit_of_measure, min_stock, category")
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

  const materialsByCategory = new Map<MaterialCategory, MaterialRow[]>();
  for (const m of materials ?? []) {
    const list = materialsByCategory.get(m.category) ?? [];
    list.push(m);
    materialsByCategory.set(m.category, list);
  }
  const principales = materialsByCategory.get("principal");
  if (principales) {
    principales.sort((a, b) => {
      const ia = PRINCIPAL_ORDER.indexOf(a.code);
      const ib = PRINCIPAL_ORDER.indexOf(b.code);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

function materialSortKey(material: MaterialRow): number {
    if (material.category !== "principal") return 0;
    const idx = PRINCIPAL_ORDER.indexOf(material.code);
    return idx === -1 ? PRINCIPAL_ORDER.length : idx;
  }

  const rows = (stock ?? [])
    .filter((row) => row.material_id && row.location_id)
    .map((row) => ({
      ...row,
      material: materialById.get(row.material_id!),
      location: locationById.get(row.location_id!),
      lot: row.lot_id ? lotById.get(row.lot_id) : undefined,
    }))
    .filter((r) => r.material && r.location)
    .filter((r) => !activeCategory || r.material!.category === activeCategory)
    .filter((r) => !activeLocationType || r.location!.type === activeLocationType)
    .sort((a, b) => {
      const catDiff = CATEGORY_ORDER.indexOf(a.material!.category) - CATEGORY_ORDER.indexOf(b.material!.category);
      if (catDiff !== 0) return catDiff;
      const materialDiff = materialSortKey(a.material!) - materialSortKey(b.material!);
      if (materialDiff !== 0) return materialDiff;
      const nameDiff = a.material!.name.localeCompare(b.material!.name);
      if (nameDiff !== 0) return nameDiff;
      return a.location!.name.localeCompare(b.location!.name);
    });

  const visibleCategories = activeCategory ? [activeCategory] : CATEGORY_ORDER;

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

      <div className="flex flex-wrap gap-2">
        <Button
          render={<Link href="/inventario" />}
          nativeButton={false}
          variant={activeCategory === null ? "secondary" : "outline"}
          size="sm"
        >
          Todos
        </Button>
        {CATEGORY_ORDER.map((category) => (
          <Button
            key={category}
            render={<Link href={`/inventario?categoria=${category}`} />}
            nativeButton={false}
            variant={activeCategory === category ? "secondary" : "outline"}
            size="sm"
          >
            {CATEGORY_LABEL[category]}
          </Button>
        ))}
      </div>

      {visibleCategories.map((category) => {
        const list = materialsByCategory.get(category);
        if (!list || list.length === 0) return null;
        return (
          <div key={category} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{CATEGORY_LABEL[category]}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {list.map((m) => (
                <MaterialCard key={m.id} material={m} total={totalByMaterial.get(m.id) ?? 0} />
              ))}
            </div>
          </div>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>Existencia por ubicación</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              render={<Link href={activeCategory ? `/inventario?categoria=${activeCategory}` : "/inventario"} />}
              nativeButton={false}
              variant={activeLocationType === null ? "secondary" : "outline"}
              size="sm"
            >
              Todas las ubicaciones
            </Button>
            {LOCATION_TYPE_ORDER.map((type) => (
              <Button
                key={type}
                render={
                  <Link
                    href={`/inventario?ubicacion=${type}${activeCategory ? `&categoria=${activeCategory}` : ""}`}
                  />
                }
                nativeButton={false}
                variant={activeLocationType === type ? "secondary" : "outline"}
                size="sm"
              >
                {LOCATION_TYPE_LABEL[type]}
              </Button>
            ))}
          </div>
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
