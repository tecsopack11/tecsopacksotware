import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DowntimeReasonForm } from "@/components/admin/downtime-reason-form";

export const dynamic = "force-dynamic";

export default async function MotivosParoAdminPage() {
  const supabase = await createClient();
  const { data: reasons } = await supabase
    .from("downtime_reasons")
    .select("id, code, name, category")
    .order("category")
    .order("name");

  return (
    <div className="space-y-6">
      <DowntimeReasonForm />
      <Card>
        <CardHeader>
          <CardTitle>Motivos de paro ({reasons?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reasons ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>
                    <Badge variant={r.category === "planeado" ? "secondary" : "outline"}>
                      {r.category === "planeado" ? "Planeado" : "No planeado"}
                    </Badge>
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
