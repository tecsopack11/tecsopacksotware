import { compareMaterials, materialName, materialType, matchesMaterial, MATERIAL_TYPES } from "@/lib/materials/catalog";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MaterialForm } from "@/components/admin/material-form";
import { CatalogDeleteButton } from "@/components/admin/catalog-delete-button";

export const dynamic = "force-dynamic";

export default async function MaterialesAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; categoria?: string }> }) {
  const { q = "", tipo, categoria } = await searchParams;
  const activeType = MATERIAL_TYPES.find((value) => value === tipo) ?? null;
  const supabase = await createClient();
  const session = await getProfile();
  const canDelete = session?.profile.is_super_admin === true;
  const { data: materials } = await supabase
    .from("materials")
    .select("id, code, name, material_type, unit_of_measure, min_stock, category")
    .order("category")
    .order("name");

  const CATEGORY_LABEL: Record<string, string> = {
    principal: "Principales",
    pigmento: "Pigmentos",
    tinta: "Tintas",
    solvente: "Solventes",
  };

  const filteredMaterials = (materials ?? []).filter((m) => matchesMaterial(m, q, activeType) && (!categoria || m.category === categoria)).sort(compareMaterials);

  return (
    <div className="space-y-6 uppercase">
      <MaterialForm />
      <form action="/admin/materiales" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">BUSCAR MATERIAL O CÓDIGO
          <input name="q" defaultValue={q} className="h-9 rounded-md border bg-background px-3 uppercase" />
        </label>
        <label className="grid gap-1 text-sm">TIPO
          <select name="tipo" defaultValue={activeType ?? ""} className="h-9 rounded-md border bg-background px-3">
            <option value="">TODOS</option>
            {MATERIAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">CATEGORÍA
          <select name="categoria" defaultValue={categoria ?? ""} className="h-9 rounded-md border bg-background px-3">
            <option value="">TODAS</option>
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => <option key={key} value={key}>{label.toUpperCase()}</option>)}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border px-4">FILTRAR</button>
        <a href="/admin/materiales" className="px-3 py-2 text-sm underline">LIMPIAR</a>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Materiales ({filteredMaterials.length.toLocaleString("es-CO")} / {(materials?.length ?? 0).toLocaleString("es-CO")})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Stock mínimo</TableHead>
                {canDelete && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.length === 0 && <TableRow><TableCell colSpan={canDelete ? 7 : 6} className="text-center text-muted-foreground">NO HAY MATERIALES QUE COINCIDAN CON LOS FILTROS.</TableCell></TableRow>}
              {filteredMaterials.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.code}</TableCell>
                  <TableCell>{materialName(m)}</TableCell>
                  <TableCell>{CATEGORY_LABEL[m.category] ?? m.category}</TableCell>
                  <TableCell>{materialType(m)}</TableCell>
                  <TableCell>{m.unit_of_measure}</TableCell>
                  <TableCell className="text-right">{Number(m.min_stock).toLocaleString("es-CO")}</TableCell>
                  {canDelete && (
                    <TableCell className="text-right">
                      <CatalogDeleteButton
                        id={m.id}
                        name={`${m.code} — ${materialName(m)}`}
                        kind="material"
                      />
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
