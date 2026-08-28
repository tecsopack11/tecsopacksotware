import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MaterialForm } from "@/components/admin/material-form";

export const dynamic = "force-dynamic";

export default async function MaterialesAdminPage() {
  const supabase = await createClient();
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

  return (
    <div className="space-y-6">
      <MaterialForm />
      <Card>
        <CardHeader>
          <CardTitle>Materiales ({materials?.length ?? 0})</CardTitle>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {(materials ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.code}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{CATEGORY_LABEL[m.category] ?? m.category}</TableCell>
                  <TableCell>{m.material_type}</TableCell>
                  <TableCell>{m.unit_of_measure}</TableCell>
                  <TableCell className="text-right">{m.min_stock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
