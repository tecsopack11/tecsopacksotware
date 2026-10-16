import { compareMaterials, materialName, materialType, matchesMaterial, MATERIAL_TYPES } from "@/lib/materials/catalog";
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
  q?: string | null;
  tipo?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.tipo) sp.set("tipo", params.tipo);
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


type MaterialRow = {
  id: string;
  name: string;
  code: string;
  unit_of_measure: string;
  min_stock: number;
  category: MaterialCategory;
  material_type: string;
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
    <Link
      href={`/inventario/materia-prima/${material.id}`}
      className="block rounded-xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`Ver detalle e historial de ${materialName(material)}`}
    >
      <Card
        className={cn(
          "h-full border-2 transition-shadow hover:shadow-md",
          status === "bajo" && "border-destructive",
          status === "cerca" && "border-warning",
          status === "ok" && "border-transparent",
        )}
      >
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{materialName(material)}</CardTitle>
          <div className="text-xs text-muted-foreground">{materialType(material)}</div>
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
          <div className="mt-3 text-xs font-medium text-primary">Ver detalle e historial →</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function isMaterialCategory(value: string): value is MaterialCategory {
  return (CATEGORY_ORDER as string[]).includes(value);
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; area?: string; ubicacion?: string; q?: string; tipo?: string }>;
}) {
  const { categoria, area, ubicacion, q = "", tipo } = await searchParams;
  const activeType = MATERIAL_TYPES.find((type) => type === tipo) ?? null;
  const filterHref = (params: Parameters<typeof buildInventarioHref>[0]) => buildInventarioHref({ q, tipo: activeType, ...params });
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
        .select("id, name, code, unit_of_measure, min_stock, category, material_type")
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
    if (!matchesMaterial(m, q, activeType)) continue;
    const list = materialsByCategory.get(m.category) ?? [];
    list.push(m);
    materialsByCategory.set(m.category, list);
  }
  for (const list of materialsByCategory.values()) list.sort(compareMaterials);

  const rows = (stock ?? [])
    .filter((row) => row.material_id && row.location_id)
    .map((row) => ({
      ...row,
      material: materialById.get(row.material_id!),
      location: locationById.get(row.location_id!),
      lot: row.lot_id ? lotById.get(row.lot_id) : undefined,
    }))
    .filter((r) => r.material && r.location)
    .filter((r) => matchesMaterial(r.material!, q, activeType))
    .filter((r) => !activeCategory || r.material!.category === activeCategory)
    .filter((r) => !activeArea || AREA_BY_LOCATION_TYPE[r.location!.type] === activeArea)
    .filter((r) => !activeLocationType || r.location!.type === activeLocationType)
    .sort((a, b) => {
      const materialDiff = compareMaterials(a.material!, b.material!);
      if (materialDiff) return materialDiff;
      return a.location!.name.localeCompare(b.location!.name);
    });

  const visibleCategories = activeCategory ? [activeCategory] : CATEGORY_ORDER;

  return (
    <div className="space-y-6 uppercase">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Materia prima</h1>
          <p className="text-muted-foreground">Existencia actual por ubicación y lote.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/inventario/auditorias" className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium">Auditorías</Link>
          <Button
            render={<Link href="/inventario/materia-prima/comportamiento" />}
            nativeButton={false}
            variant="outline"
          >
            Comportamiento general
          </Button>
          <Button render={<Link href="/inventario/costos" />} nativeButton={false} variant="outline">Costos de MP</Button>
          <Button render={<Link href="/inventario/movimientos" />} nativeButton={false} variant="outline">
            Historial
          </Button>
          <Button
            render={<Link href="/inventario/registro" />}
            nativeButton={false}
            size="lg"
            className="px-5 text-base font-semibold shadow-sm"
          >
            Ingresos / Salidas
          </Button>
        </div>
      </div>

      <form action="/inventario/materia-prima" className="flex flex-wrap items-end gap-3">
        {activeCategory && <input type="hidden" name="categoria" value={activeCategory} />}
        {activeArea && <input type="hidden" name="area" value={activeArea} />}
        {activeLocationType && <input type="hidden" name="ubicacion" value={activeLocationType} />}
        <label className="grid gap-1 text-sm">BUSCAR MATERIAL O CÓDIGO
          <input name="q" defaultValue={q} placeholder="NOMBRE O CÓDIGO" className="h-9 rounded-md border bg-background px-3 uppercase" />
        </label>
        <label className="grid gap-1 text-sm">TIPO
          <select name="tipo" defaultValue={activeType ?? ""} className="h-9 rounded-md border bg-background px-3">
            <option value="">TODOS LOS TIPOS</option>
            {MATERIAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <Button type="submit">FILTRAR</Button>
        <Link href="/inventario/materia-prima" className="px-3 py-2 text-sm underline">LIMPIAR</Link>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button
          render={<Link href={filterHref({ area: activeArea, ubicacion: activeLocationType })} />}
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
                href={filterHref({
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
                href={filterHref({
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
        {visibleCategories.every((category) => !materialsByCategory.get(category)?.length) && <p className="text-muted-foreground">NO HAY MATERIALES QUE COINCIDAN CON LOS FILTROS.</p>}
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
              render={<Link href={filterHref({ categoria: activeCategory })} />}
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
                  <Link href={filterHref({ categoria: activeCategory, area: a })} />
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
                <Link href={filterHref({ categoria: activeCategory, area: activeArea })} />
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
                    href={filterHref({
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
                    {materialName(row.material!)}{" "}
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
