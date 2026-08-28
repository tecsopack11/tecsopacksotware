import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MachineForm } from "@/components/admin/machine-form";

export const dynamic = "force-dynamic";

export default async function MaquinasAdminPage() {
  const supabase = await createClient();
  const { data: machines } = await supabase
    .from("machines")
    .select("id, code, name, machine_type, ideal_run_rate_per_hour")
    .order("name");

  return (
    <div className="space-y-6">
      <MachineForm />
      <Card>
        <CardHeader>
          <CardTitle>Máquinas ({machines?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Tasa ideal (pza/h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(machines ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{m.code}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.machine_type ?? "—"}</TableCell>
                  <TableCell className="text-right">{m.ideal_run_rate_per_hour ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
