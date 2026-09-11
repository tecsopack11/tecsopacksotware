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

// Agrupa las ubicaciones en dos áreas de planta para el traslado interno:
// Bodega (almacenamiento) y Proceso (piso de fábrica + máquinas).
type Area = "bodega" | "proceso";
const AREA_BY_LOCATION_TYPE: Record<string, Area | undefined> = {
  bodega: "bodega",
  piso: "proceso",
  maquina: "proceso",
};
const AREA_ORDER: Area[] = ["bodega", "proceso"];
const AREA_LABEL: Record<Area, string> = {
  bodega: "Bodega",
  proceso: "Proceso productivo",
};

function isArea(value: string): value is Area {
  return (AREA_ORDER as string[]).includes(value);
}

function buildInventarioHref(params: {
  categoria?: string | null;
  area?: string | null;
  ubicacion?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params.categoria) sp.set("categoria", params.categoria);
  if (params.area) sp.set("area", params.area);
  if (params.ubicacion) sp.set("ubicacion", params.ubicacion);
  const qs = sp.toString();
  return qs ? `/inventario/materia-prima?${qs}` : "/inventario/materia-prima";
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

function MaterialCard({
  material,
  total,
  showThreshold,
}: {
  material: MaterialRow;
  total: number;
  showThreshold: boolean;
}) {
  const status =
    showThreshold && material.min_stock > 0 && total < material.min_stock
      ? "bajo"
      : showThreshold && material.min_stock > 0 && total < material.min_stock * 1.25
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
        {showThreshold && (
          <div className="mt-1 text-xs text-muted-foreground">
            Mínimo: {material.min_stock.toLocaleString("es-CO")} {material.unit_of_measure}
          </div>
        )}
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
  searchParams: Promise<{ categoria?: string; area?: string; ubicacion?: string }>;
}) {
  const { categoria, area, ubicacion } = await searchParams;
  const activeCategory = categoria && isMaterialCategory(categoria) ? categoria : null;
  const activeArea = area && isArea(area) ? area : null;
  const activeLocationType = ubicacion && isLocationType(ubicacion) ? ubicacion : null;
  // Las tarjetas de arriba siempre muestran una sola área a la vez; "Bodega"
  // es el estado por defecto al entrar a la página.
  const topArea: Area = activeArea ?? "bodega";

  const supabase = await createClient();

  const [{ data: stock }, { data: materials }, { data: locations }, { data: lots }, { data: consumo }] =
    await Promise.all([
      supabase.from("v_inventory_stock").select("material_id, lot_id, location_id, quantity"),
      supabase
        .from("materials")
        .select("id, name, code, unit_of_measure, min_stock, category")
        .eq("active", true)
        .order("name"),
      supabase.from("locations").select("id, name, type"),
      supabase.from("material_lots").select("id, lot_code"),
      supabase.from("v_material_consumo_por_ubicacion").select("material_id, location_id, consumido"),
    ]);

  const materialById = new Map((materials ?? []).map((m) => [m.id, m]));
  const locationById = new Map((locations ?? []).map((l) => [l.id, l]));
  const lotById = new Map((lots ?? []).map((l) => [l.id, l]));
  const consumidoByMaterialLocation = new Map(
    (consumo ?? [])
      .filter((c) => c.material_id && c.location_id)
      .map((c) => [`${c.material_id}-${c.location_id}`, Number(c.consumido)]),
  );

  // Total por material, separado por área (bodega vs proceso productivo) — base
  // para las casillas de arriba y para decidir si hay que pedir/comprar (solo
  // contra lo que hay en bodega). Ubicaciones externo/merma no cuentan en
  // ninguna de las dos áreas.
  const totalByMaterialByArea: Record<Area, Map<string, number>> = {
    bodega: new Map<string, number>(),
    proceso: new Map<string, number>(),
  };
  for (const row of stock ?? []) {
    if (!row.material_id || !row.location_id) continue;
    const location = locationById.get(row.location_id);
    const area = location ? AREA_BY_LOCATION_TYPE[location.type] : undefined;
    if (!area) continue;
    const target = totalByMaterialByArea[area];
    target.set(row.material_id, (target.get(row.material_id) ?? 0) + Number(row.quantity));
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
    .filter((r) => !activeArea || AREA_BY_LOCATION_TYPE[r.location!.type] === activeArea)
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
          <h1 className="text-2xl font-semibold">Materia prima</h1>
          <p className="text-muted-foreground">Existencia actual por ubicación y lote.</p>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/inventario/movimientos" />} nativeButton={false} variant="outline">
            Historial
          </Button>
          <Button
            render={<Link href="/inventario/registro" />}
            nativeButton={false}
            variant="outline"
          >
            Registro
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          render={<Link href={buildInventarioHref({ area: activeArea, ubicacion: activeLocationType })} />}
          nativeButton={false}
          variant={activeCategory === null ? "secondary" : "outline"}
          size="sm"
        >
          Todos
        </Button>
        {CATEGORY_ORDER.map((category) => (
          <Button
            key={category}
            render={
              <Link
                href={buildInventarioHref({
                  categoria: category,
                  area: activeArea,
                  ubicacion: activeLocationType,
                })}
              />
            }
            nativeButton={false}
            variant={activeCategory === category ? "secondary" : "outline"}
            size="sm"
          >
            {CATEGORY_LABEL[category]}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {AREA_ORDER.map((a) => (
          <Button
            key={a}
            render={
              <Link
                href={buildInventarioHref({
                  categoria: activeCategory,
                  area: a,
                  ubicacion: activeLocationType,
                })}
              />
            }
            nativeButton={false}
            variant={topArea === a ? "secondary" : "outline"}
          >
            {AREA_LABEL[a]}
          </Button>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">{AREA_LABEL[topArea]}</h2>
        {visibleCategories.map((category) => {
          const list = materialsByCategory.get(category);
          if (!list || list.length === 0) return null;
          return (
            <div key={category} className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">{CATEGORY_LABEL[category]}</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((m) => (
                  <MaterialCard
                    key={m.id}
                    material={m}
                    total={totalByMaterialByArea[topArea].get(m.id) ?? 0}
                    showThreshold={topArea === "bodega"}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existencia por ubicación</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              render={<Link href={buildInventarioHref({ categoria: activeCategory })} />}
              nativeButton={false}
              variant={activeArea === null ? "secondary" : "outline"}
              size="sm"
            >
              Todas las áreas
            </Button>
            {AREA_ORDER.map((a) => (
              <Button
                key={a}
                render={
                  <Link href={buildInventarioHref({ categoria: activeCategory, area: a })} />
                }
                nativeButton={false}
                variant={activeArea === a ? "secondary" : "outline"}
                size="sm"
              >
                {AREA_LABEL[a]}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              render={
                <Link href={buildInventarioHref({ categoria: activeCategory, area: activeArea })} />
              }
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
                    href={buildInventarioHref({
                      categoria: activeCategory,
                      area: activeArea,
                      ubicacion: type,
                    })}
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
                <TableHead className="text-right">{activeArea === "proceso" ? "En piso" : "Cantidad"}</TableHead>
                {activeArea === "proceso" && <TableHead className="text-right">Consumido</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={activeArea === "proceso" ? 5 : 4} className="text-center text-muted-foreground">
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
                  {activeArea === "proceso" && (
                    <TableCell className="text-right text-muted-foreground">
                      {(
                        consumidoByMaterialLocation.get(`${row.material_id}-${row.location_id}`) ?? 0
                      ).toLocaleString("es-CO")}{" "}
                      {row.material!.unit_of_measure}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
