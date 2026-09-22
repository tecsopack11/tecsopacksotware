import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const MOVEMENT_LABEL: Record<string, string> = {
  entrada: "Entrada / compra",
  salida: "Salida / venta",
  traslado: "Traslado",
  consumo: "Consumo",
  ajuste: "Ajuste",
};

const LOCATION_TYPE_LABEL: Record<string, string> = {
  bodega: "Bodega",
  piso: "Piso",
  maquina: "Máquina",
  externo: "Externo",
  merma: "Merma",
};

function amount(value: number) {
  return value.toLocaleString("es-CO", { maximumFractionDigits: 3 });
}

function date(value: string) {
  return new Date(`${value}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ materialId: string }>;
}) {
  const { materialId } = await params;
  const supabase = await createClient();

  const [materialResult, stockResult, locationResult, lotResult, movementResult] = await Promise.all([
    supabase
      .from("materials")
      .select("id, code, name, unit_of_measure, min_stock, material_type, category, active")
      .eq("id", materialId)
      .maybeSingle(),
    supabase
      .from("v_inventory_stock")
      .select("lot_id, location_id, quantity")
      .eq("material_id", materialId),
    supabase.from("locations").select("id, name, type"),
    supabase
      .from("material_lots")
      .select("id, lot_code, supplier, received_date")
      .eq("material_id", materialId),
    supabase
      .from("inventory_movements")
      .select(
        "id, movement_type, quantity, effective_date, created_at, reference_doc, notes, reason_code, cancelled_at, received_at, from:from_location_id(name), to:to_location_id(name), material_lots(lot_code, supplier, received_date), profiles!inventory_movements_created_by_fkey(full_name)",
      )
      .eq("material_id", materialId)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const material = materialResult.data;
  if (!material) notFound();

  const locations = new Map((locationResult.data ?? []).map((row) => [row.id, row]));
  const lots = new Map((lotResult.data ?? []).map((row) => [row.id, row]));
  const stock = (stockResult.data ?? []).map((row) => ({
    ...row,
    location: row.location_id ? locations.get(row.location_id) : undefined,
    lot: row.lot_id ? lots.get(row.lot_id) : undefined,
  }));
  const movements = movementResult.data ?? [];
  const activeMovements = movements.filter((movement) => !movement.cancelled_at);
  const sumType = (type: string) =>
    activeMovements
      .filter((movement) => movement.movement_type === type)
      .reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const total = stock.reduce((sum, row) => sum + Number(row.quantity), 0);
  const entries = sumType("entrada");
  const consumed = sumType("consumo");
  const outputs = sumType("salida");
  const pendingTransfers = activeMovements.filter(
    (movement) => movement.movement_type === "traslado" && !movement.received_at,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{material.code}</Badge>
            <Badge variant="secondary">{material.material_type}</Badge>
            {!material.active && <Badge variant="destructive">Inactivo</Badge>}
          </div>
          <h1 className="text-2xl font-semibold">{material.name}</h1>
          <p className="text-muted-foreground">
            Existencia, compras y recorrido completo de esta materia prima.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href={`/inventario/registro?material=${material.id}`} />}
            nativeButton={false}
          >
            Registrar movimiento
          </Button>
          <Button
            render={<Link href="/inventario/materia-prima" />}
            nativeButton={false}
            variant="outline"
          >
            Volver a materia prima
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Existencia actual", total],
          ["Entradas acumuladas", entries],
          ["Consumido en producción", consumed],
          ["Salidas / ventas", outputs],
          ["Traslados pendientes", pendingTransfers.reduce((sum, m) => sum + Number(m.quantity), 0)],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {amount(Number(value))} {material.unit_of_measure}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existencia actual por ubicación y lote</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ubicación</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Recibido</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay existencia disponible actualmente.
                  </TableCell>
                </TableRow>
              )}
              {stock.map((row) => (
                <TableRow key={`${row.location_id}-${row.lot_id}`}>
                  <TableCell>{row.location?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {LOCATION_TYPE_LABEL[row.location?.type ?? ""] ?? row.location?.type ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.lot?.lot_code ?? "—"}</TableCell>
                  <TableCell>{row.lot?.supplier ?? "—"}</TableCell>
                  <TableCell>
                    {row.lot?.received_date ? date(row.lot.received_date) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {amount(Number(row.quantity))} {material.unit_of_measure}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial del material ({movements.length})</CardTitle>
          <p className="text-sm text-muted-foreground">
            Del movimiento más reciente al más antiguo. Máximo 500 registros.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead>Lote / proveedor</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Documento / nota</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Esta materia prima todavía no tiene movimientos.
                  </TableCell>
                </TableRow>
              )}
              {movements.map((movement) => {
                const pending =
                  movement.movement_type === "traslado" &&
                  !movement.cancelled_at &&
                  !movement.received_at;
                return (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap">
                      {date(movement.effective_date)}
                    </TableCell>
                    <TableCell>{MOVEMENT_LABEL[movement.movement_type]}</TableCell>
                    <TableCell>
                      <div>{movement.material_lots?.lot_code ?? "—"}</div>
                      {movement.material_lots?.supplier && (
                        <div className="text-xs text-muted-foreground">
                          {movement.material_lots.supplier}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{movement.from?.name ?? "—"}</TableCell>
                    <TableCell>{movement.to?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-64">
                      <div>{movement.reference_doc ?? movement.reason_code ?? "—"}</div>
                      {movement.notes && (
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {movement.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{movement.profiles?.full_name || "—"}</TableCell>
                    <TableCell>
                      {movement.cancelled_at ? (
                        <Badge variant="destructive">Cancelado</Badge>
                      ) : pending ? (
                        <Badge variant="outline" className="border-warning text-warning">
                          En tránsito
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Completado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {amount(Number(movement.quantity))} {material.unit_of_measure}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
