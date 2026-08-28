import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/get-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CancelMovementButton } from "@/components/inventario/cancel-movement-button";

export const dynamic = "force-dynamic";

const MOVEMENT_LABEL: Record<string, string> = {
  entrada: "Entrada",
  salida: "Salida",
  traslado: "Traslado",
  consumo: "Consumo",
  ajuste: "Ajuste",
};

export default async function MovimientosPage() {
  const supabase = await createClient();
  const session = await getProfile();
  const canCancel = session?.profile.role === "supervisor" || session?.profile.role === "admin";

  const { data: movements } = await supabase
    .from("inventory_movements")
    .select(
      "id, movement_type, quantity, created_at, cancelled_at, notes, materials(name, unit_of_measure), from:from_location_id(name), to:to_location_id(name), material_lots(lot_code), profiles!inventory_movements_created_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Historial de movimientos</h1>
        <p className="text-muted-foreground">Últimos 200 movimientos registrados.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Por</TableHead>
                <TableHead>Estado</TableHead>
                {canCancel && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movements ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell>{MOVEMENT_LABEL[m.movement_type]}</TableCell>
                  <TableCell>{m.materials?.name}</TableCell>
                  <TableCell>{m.material_lots?.lot_code ?? "—"}</TableCell>
                  <TableCell>{m.from?.name ?? "—"}</TableCell>
                  <TableCell>{m.to?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {Number(m.quantity).toLocaleString("es-CL")} {m.materials?.unit_of_measure}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.profiles?.full_name || "—"}
                  </TableCell>
                  <TableCell>
                    {m.cancelled_at ? (
                      <Badge variant="destructive">Cancelado</Badge>
                    ) : (
                      <Badge variant="secondary">Activo</Badge>
                    )}
                  </TableCell>
                  {canCancel && (
                    <TableCell>
                      {!m.cancelled_at && <CancelMovementButton movementId={m.id} />}
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
