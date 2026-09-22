import Link from "next/link";
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
import { cn } from "@/lib/utils";
import { bogotaDate } from "@/lib/costs/schema";

export const dynamic = "force-dynamic";

const PERIODS = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "all", label: "Todo el historial" },
] as const;

function amount(value: number) {
  return value.toLocaleString("es-CO", { maximumFractionDigits: 3 });
}

type Totals = {
  entries: number;
  consumed: number;
  outputs: number;
  transfers: number;
};

export default async function MaterialBehaviorPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const period = PERIODS.some((item) => item.value === periodo) ? periodo! : "30";
  const today = bogotaDate();
  const since =
    period === "all"
      ? null
      : new Date(
          new Date(`${today}T12:00:00Z`).getTime() - Number(period) * 86_400_000,
        )
          .toISOString()
          .slice(0, 10);
  const supabase = await createClient();

  let movementQuery = supabase
    .from("inventory_movements")
    .select("material_id, movement_type, quantity, cancelled_at, received_at, effective_date")
    .order("effective_date", { ascending: false });
  if (since) movementQuery = movementQuery.gte("effective_date", since);

  const [{ data: materials }, { data: stock }, { data: movements }] = await Promise.all([
    supabase
      .from("materials")
      .select("id, code, name, unit_of_measure, min_stock, category")
      .eq("active", true)
      .order("name"),
    supabase.from("v_inventory_stock").select("material_id, quantity"),
    movementQuery,
  ]);

  const stockByMaterial = new Map<string, number>();
  for (const row of stock ?? []) {
    if (!row.material_id) continue;
    stockByMaterial.set(
      row.material_id,
      (stockByMaterial.get(row.material_id) ?? 0) + Number(row.quantity),
    );
  }

  const totalsByMaterial = new Map<string, Totals>();
  for (const movement of movements ?? []) {
    if (movement.cancelled_at) continue;
    const totals = totalsByMaterial.get(movement.material_id) ?? {
      entries: 0,
      consumed: 0,
      outputs: 0,
      transfers: 0,
    };
    const quantity = Number(movement.quantity);
    if (movement.movement_type === "entrada") totals.entries += quantity;
    if (movement.movement_type === "consumo") totals.consumed += quantity;
    if (movement.movement_type === "salida") totals.outputs += quantity;
    if (movement.movement_type === "traslado") totals.transfers += quantity;
    totalsByMaterial.set(movement.material_id, totals);
  }

  const rows = (materials ?? []).map((material) => {
    const totals = totalsByMaterial.get(material.id) ?? {
      entries: 0,
      consumed: 0,
      outputs: 0,
      transfers: 0,
    };
    return {
      ...material,
      ...totals,
      stock: stockByMaterial.get(material.id) ?? 0,
      balance: totals.entries - totals.consumed - totals.outputs,
    };
  });
  const general = rows.reduce(
    (sum, row) => ({
      stock: sum.stock + row.stock,
      entries: sum.entries + row.entries,
      consumed: sum.consumed + row.consumed,
      outputs: sum.outputs + row.outputs,
    }),
    { stock: 0, entries: 0, consumed: 0, outputs: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Comportamiento de materias primas</h1>
          <p className="text-muted-foreground">
            Comparativo de entradas, consumo y salidas de todos los materiales.
          </p>
        </div>
        <Button
          render={<Link href="/inventario/materia-prima" />}
          nativeButton={false}
          variant="outline"
        >
          Volver a materia prima
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <Button
            key={item.value}
            render={
              <Link href={`/inventario/materia-prima/comportamiento?periodo=${item.value}`} />
            }
            nativeButton={false}
            variant={period === item.value ? "secondary" : "outline"}
            size="sm"
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Existencia actual total", general.stock],
          ["Entradas del periodo", general.entries],
          ["Consumo del periodo", general.consumed],
          ["Salidas / ventas del periodo", general.outputs],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {amount(Number(value))} kg
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo por materia prima</CardTitle>
          <p className="text-sm text-muted-foreground">
            Selecciona una fila para consultar ubicaciones, lotes y el historial completo.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Materia prima</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Existencia actual</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Consumo</TableHead>
                <TableHead className="text-right">Salidas / ventas</TableHead>
                <TableHead className="text-right">Trasladado</TableHead>
                <TableHead className="text-right">Balance periodo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const low = row.min_stock > 0 && row.stock < row.min_stock;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/inventario/materia-prima/${row.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.code}</div>
                    </TableCell>
                    <TableCell className="capitalize">{row.category}</TableCell>
                    {[row.stock, row.entries, row.consumed, row.outputs, row.transfers].map(
                      (value, index) => (
                        <TableCell key={index} className="text-right">
                          {amount(value)} {row.unit_of_measure}
                        </TableCell>
                      ),
                    )}
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        row.balance < 0 && "text-destructive",
                      )}
                    >
                      {row.balance > 0 ? "+" : ""}
                      {amount(row.balance)} {row.unit_of_measure}
                    </TableCell>
                    <TableCell>
                      {low ? (
                        <Badge variant="destructive">Pedir / comprar</Badge>
                      ) : (
                        <Badge variant="secondary">Disponible</Badge>
                      )}
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
