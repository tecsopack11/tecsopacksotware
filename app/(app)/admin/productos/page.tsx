import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductForm } from "@/components/admin/product-form";
import { CatalogDeleteButton } from "@/components/admin/catalog-delete-button";

export const dynamic = "force-dynamic";

export default async function ProductosAdminPage() {
  const supabase = await createClient();
  const session = await getProfile();
  const canDelete = session?.profile.is_super_admin === true;
  const { data: products } = await supabase
    .from("products")
    .select("id, code, name, unit_of_measure, min_stock")
    .order("name");

  return (
    <div className="space-y-6">
      <ProductForm />
      <Card>
        <CardHeader>
          <CardTitle>Productos ({products?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Stock mínimo</TableHead>
                {canDelete && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(products ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.unit_of_measure}</TableCell>
                  <TableCell className="text-right">{p.min_stock}</TableCell>
                  {canDelete && (
                    <TableCell className="text-right">
                      <CatalogDeleteButton
                        id={p.id}
                        name={`${p.code} — ${p.name}`}
                        kind="producto"
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
