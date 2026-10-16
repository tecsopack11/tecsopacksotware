import Link from "next/link";
import { randomUUID } from "node:crypto";
import { getCostSnapshot } from "@/lib/costs/data";
import { bogotaDate } from "@/lib/costs/schema";
import {
  formatCop,
  valueInventory,
  weightedPurchaseAverage,
} from "@/lib/costs/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CostExport } from "@/components/costos/cost-export";
import { MixCalculator } from "@/components/costos/mix-calculator";
import { QuickCostEntry } from "@/components/costos/quick-cost-entry";

export const dynamic = "force-dynamic";
const amount = (value: number) =>
  value.toLocaleString("es-CO", { maximumFractionDigits: 3 });

export default async function MaterialCostsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    ano?: string;
    periodo?: string;
    material?: string;
    estado?: string;
    pagina?: string;
    guardado?: string;
  }>;
}) {
  const params = await searchParams;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes ?? "")
    ? params.mes!
    : bogotaDate().slice(0, 7);
  const year = /^(19|20|21)\d{2}$/.test(params.ano ?? "")
    ? params.ano!
    : month.slice(0, 4);
  const annualHistory = params.periodo !== "mes";
  const historyPeriod = annualHistory ? year : month;
  const { snapshot, error } = await getCostSnapshot();
  if (!snapshot)
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">COSTOS DE MATERIA PRIMA</h1>
        <p role="alert" className="text-destructive">
          {error}
        </p>
      </div>
    );
  const materials = snapshot.materials;
  const activeMaterials = materials.filter((material) => material.active);
  const quickLocation =
    snapshot.locations.find(
      (location) => location.active && location.type === "bodega",
    );
  const locations = new Map(snapshot.locations.map((l) => [l.id, l]));
  const internal = new Set(
    snapshot.locations
      .filter((l) => ["bodega", "piso", "maquina"].includes(l.type))
      .map((l) => l.id),
  );
  const prices = new Map(snapshot.costs.map((c) => [c.movement_id, c]));
  const balances = valueInventory(snapshot.movements, snapshot.costs, internal);
  const monthlyBalances = valueInventory(
    snapshot.movements.filter((m) => m.effective_date.slice(0, 7) <= month),
    snapshot.costs,
    internal,
  );
  const receipts = snapshot.movements.filter(
    (m) =>
      !m.cancelled_at &&
      m.movement_type === "entrada" &&
      !m.from_location_id &&
      internal.has(m.to_location_id ?? ""),
  );
  const receiptMonth = (m: (typeof receipts)[number]) =>
    (prices.get(m.id)?.purchase_date ?? m.effective_date).slice(0, 7);
  const visibleMaterials = materials.filter(
    (m) => !params.material || m.id === params.material,
  );
  const monthReceipts = receipts.filter(
    (m) =>
      receiptMonth(m) === month &&
      (!params.material || m.material_id === params.material),
  );
  const knownPurchases = monthReceipts.reduce(
    (total, m) => total + (prices.get(m.id)?.total_cop ?? 0),
    0,
  );
  const pendingReceipts = monthReceipts.filter((m) => !prices.has(m.id)).length;
  const provisionalReceipts = monthReceipts.filter(
    (m) => prices.get(m.id)?.status === "provisional",
  ).length;
  let knownInventory = 0,
    unvaluedMaterials = 0;
  for (const material of visibleMaterials) {
    const balance = balances.get(material.id);
    if (!balance) continue;
    if (balance.value === null) unvaluedMaterials++;
    else knownInventory += balance.value;
  }
  const physical = new Map<string, { warehouse: number; floor: number }>();
  for (const m of snapshot.movements) {
    if (m.cancelled_at) continue;
    const row = physical.get(m.material_id) ?? { warehouse: 0, floor: 0 };
    for (const [id, sign] of [
      [m.from_location_id, -1],
      [m.to_location_id, 1],
    ] as const) {
      if (
        !id ||
        (sign === 1 && m.movement_type === "traslado" && !m.received_at)
      )
        continue;
      const type = locations.get(id)?.type;
      if (type === "bodega") row.warehouse += sign * m.quantity;
      if (type === "piso" || type === "maquina") row.floor += sign * m.quantity;
    }
    physical.set(m.material_id, row);
  }
  let floorValue = 0,
    floorPending = 0,
    closingValue = 0,
    closingPending = 0;
  for (const material of visibleMaterials) {
    const floor = physical.get(material.id)?.floor ?? 0;
    const average = balances.get(material.id)?.average;
    if (floor !== 0) {
      if (average == null || floor < 0) floorPending++;
      else floorValue += floor * average;
    }
    const closing = monthlyBalances.get(material.id);
    if (closing?.value === null) closingPending++;
    else closingValue += closing?.value ?? 0;
  }
  const historyReceipts = receipts.filter((m) =>
    receiptMonth(m).startsWith(historyPeriod) &&
    (!params.material || m.material_id === params.material),
  );
  const filtered = historyReceipts
    .filter(
      (m) =>
        !params.estado ||
        (params.estado === "pending"
          ? !prices.has(m.id)
          : prices.get(m.id)?.status === params.estado),
    )
    .sort((a, b) => receiptMonth(b).localeCompare(receiptMonth(a)) ||
      (prices.get(b.id)?.purchase_date ?? b.effective_date).localeCompare(prices.get(a.id)?.purchase_date ?? a.effective_date) ||
      b.created_at.localeCompare(a.created_at) || b.valuation_sequence - a.valuation_sequence);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 30));
  const page = Math.min(
    pageCount,
    Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1),
  );
  const pageHref = (n: number) =>
    `/inventario/costos?${new URLSearchParams({ mes: month, ano: year, periodo: annualHistory ? "ano" : "mes", material: params.material ?? "", estado: params.estado ?? "", pagina: String(n) })}`;
  const optionClass =
    "h-10 rounded-md border border-input bg-background px-3 text-sm";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">COSTOS DE MATERIA PRIMA</h1>
          <p className="text-muted-foreground">
            PROMEDIO PONDERADO ANUAL, HISTORIAL DE COMPRAS Y VALOR DISPONIBLE EN PLANTA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            render={<Link href="/inventario/registro" />}
            nativeButton={false}
            variant="outline"
          >
            Registro diario de inventario
          </Button>
        </div>
      </div>
      {params.guardado && (
        <p
          role="status"
          className="rounded-md border border-primary/30 bg-accent p-3"
        >
          Compra y costo guardados. El historial y el promedio ya fueron
          actualizados.
        </p>
      )}
      {activeMaterials.length > 0 && quickLocation ? (
        <QuickCostEntry
          materials={activeMaterials.map((material) => ({
            id: material.id,
            name: material.name,
            code: material.code,
            unit: material.unit_of_measure,
          }))}
          locationId={quickLocation.id}
          today={bogotaDate()}
          requestId={randomUUID()}
        />
      ) : (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          Registra al menos un material y una ubicación de bodega para ingresar
          compras.
        </p>
      )}
      <form className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          AÑO DEL PROMEDIO Y DEL HISTORIAL
          <input aria-label="Año de compras" type="number" name="ano" min="1900" max="2199" defaultValue={year} className={optionClass} required />
        </label>
        <label className="grid gap-1 text-sm">
          PERÍODO DEL HISTORIAL
          <select name="periodo" defaultValue={annualHistory ? "ano" : "mes"} className={optionClass}>
            <option value="ano">TODO EL AÑO</option>
            <option value="mes">MES SELECCIONADO</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          MES PARA COMPARATIVO Y CIERRE
          <input
            aria-label="Mes de compra"
            type="month"
            name="mes"
            defaultValue={month}
            className={optionClass}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          Material
          <select
            name="material"
            defaultValue={params.material ?? ""}
            className={optionClass}
          >
            <option value="">Todos los materiales</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Estado de las entradas
          <select
            name="estado"
            defaultValue={params.estado ?? ""}
            className={optionClass}
          >
            <option value="">Todos</option>
            <option value="pending">Sin precio</option>
            <option value="provisional">Provisional</option>
            <option value="confirmed">Confirmado</option>
          </select>
        </label>
        <Button variant="outline">Consultar</Button>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>PROMEDIO PONDERADO ANUAL · {year}</CardTitle>
          <p className="text-sm text-muted-foreground">
            SUMA DEL VALOR DE COMPRAS ÷ SUMA DE LA CANTIDAD CON COSTO, POR MATERIAL.
            Incluye gastos registrados y costos provisionales. Las entradas sin precio quedan pendientes y no se toman como cero.
            El año corresponde a la fecha de compra; para entradas pendientes se usa la fecha operativa.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>MATERIA PRIMA</TableHead><TableHead>ENTRADAS</TableHead>
              <TableHead>CANTIDAD CON COSTO</TableHead><TableHead>VALOR DE COMPRAS</TableHead>
              <TableHead>PROMEDIO / UNIDAD</TableHead><TableHead>SIN PRECIO</TableHead><TableHead>PROVISIONALES</TableHead>
            </TableRow></TableHeader>
            <TableBody>{visibleMaterials.map((material) => {
              const purchases = receipts.filter((m) => m.material_id === material.id && receiptMonth(m).startsWith(year));
              const summary = weightedPurchaseAverage(purchases.map((m) => ({ quantity: m.quantity, total: prices.get(m.id)?.total_cop ?? null })));
              const pendingQuantity = purchases.filter((m) => !prices.has(m.id)).reduce((sum, m) => sum + m.quantity, 0);
              const provisional = purchases.filter((m) => prices.get(m.id)?.status === "provisional").length;
              return <TableRow key={material.id}>
                <TableCell>{material.name.toLocaleUpperCase("es-CO")}</TableCell>
                <TableCell>{amount(purchases.length)}</TableCell>
                <TableCell>{amount(summary.quantity)} {material.unit_of_measure}</TableCell>
                <TableCell>{formatCop(summary.quantity > 0 ? summary.total : null)}</TableCell>
                <TableCell>{formatCop(summary.average)} / {material.unit_of_measure}
                  {(summary.pending > 0 || provisional > 0) && <span className="block text-xs text-muted-foreground">PROMEDIO INCOMPLETO O PROVISIONAL</span>}
                </TableCell>
                <TableCell>{summary.pending} · {amount(pendingQuantity)} {material.unit_of_measure}</TableCell>
                <TableCell>{provisional}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">Puede registrar tantas compras como necesite. Los consumos y traslados no alteran este promedio de compras; el promedio móvil del inventario se consulta por separado abajo. Las correcciones posteriores de precios actualizan el reporte anual; no es un cierre contable bloqueado.</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Compras valoradas del mes",
            formatCop(knownPurchases),
            `${pendingReceipts} entrada(s) sin precio excluidas`,
          ],
          [
            "Costos por completar",
            String(pendingReceipts + provisionalReceipts),
            `${provisionalReceipts} provisionales · ${pendingReceipts} sin precio`,
          ],
          [
            "Valor actual identificado",
            formatCop(knownInventory),
            `${unvaluedMaterials} material(es) con valoración pendiente`,
          ],
          [
            "Valor actual en piso / máquinas",
            formatCop(floorValue),
            `${floorPending} material(es) pendientes excluidos`,
          ],
        ].map(([title, value, note]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Promedio de compras de {month}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Valor de las compras ÷ cantidad comprada de cada material. Incluye
            los gastos registrados. Las entradas sin precio se excluyen y se
            indican como pendientes.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Cantidad con costo</TableHead>
                <TableHead>Costo de compras</TableHead>
                <TableHead>Promedio / unidad</TableHead>
                <TableHead>Mes anterior</TableHead>
                <TableHead>Variación</TableHead>
                <TableHead>Pendientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMaterials.map((material) => {
                const previousDate = new Date(`${month}-01T12:00:00Z`);
                previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
                const previous = previousDate.toISOString().slice(0, 7);
                const aggregate = (period: string) =>
                  weightedPurchaseAverage(
                    receipts
                      .filter(
                        (m) =>
                          m.material_id === material.id &&
                          receiptMonth(m) === period,
                      )
                      .map((m) => ({
                        quantity: m.quantity,
                        total: prices.get(m.id)?.total_cop ?? null,
                      })),
                  );
                const now = aggregate(month),
                  before = aggregate(previous);
                const variation =
                  now.average !== null &&
                  before.average !== null &&
                  before.average > 0 &&
                  !now.pending &&
                  !before.pending
                    ? (now.average / before.average - 1) * 100
                    : null;
                return (
                  <TableRow key={material.id}>
                    <TableCell>{material.name}</TableCell>
                    <TableCell>
                      {amount(now.quantity)} {material.unit_of_measure}
                    </TableCell>
                    <TableCell>{formatCop(now.total)}</TableCell>
                    <TableCell>
                      {formatCop(now.average)} / {material.unit_of_measure}
                    </TableCell>
                    <TableCell>{formatCop(before.average)}</TableCell>
                    <TableCell>
                      {variation === null
                        ? "—"
                        : `${variation > 0 ? "+" : ""}${variation.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                    </TableCell>
                    <TableCell>{now.pending || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Materia prima disponible hoy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cantidad y valor por área, usando el promedio global de cada
            material. Esta vista siempre es actual; el filtro de mes corresponde
            al comparativo mensual y al cierre. Incluye costos provisionales y se reconstruye al corregir
            precios o cancelar movimientos.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Promedio actual</TableHead>
                <TableHead>En bodega</TableHead>
                <TableHead>Valor bodega</TableHead>
                <TableHead>En piso / máquinas</TableHead>
                <TableHead>Valor en piso</TableHead>
                <TableHead>En tránsito</TableHead>
                <TableHead>Valor total</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMaterials.map((material) => {
                const b = balances.get(material.id);
                const p = physical.get(material.id) ?? {
                  warehouse: 0,
                  floor: 0,
                };
                const value = (q: number) =>
                  q === 0
                    ? 0
                    : b?.average == null || q < 0
                      ? null
                      : q * b.average;
                return (
                  <TableRow key={material.id}>
                    <TableCell>
                      {material.name}
                      <span className="block text-xs text-muted-foreground">
                        {material.unit_of_measure}
                      </span>
                    </TableCell>
                    <TableCell>{formatCop(b?.average ?? null)}</TableCell>
                    <TableCell>{amount(p.warehouse)}</TableCell>
                    <TableCell>{formatCop(value(p.warehouse))}</TableCell>
                    <TableCell>{amount(p.floor)}</TableCell>
                    <TableCell>{formatCop(value(p.floor))}</TableCell>
                    <TableCell>{amount(b?.transit ?? 0)}</TableCell>
                    <TableCell>{formatCop(b ? b.value : 0)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          b?.issue || b?.value === null
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {b?.issue
                          ? "Revisar movimientos"
                          : b?.value === null
                            ? "Faltan costos"
                            : b?.provisional
                              ? "Provisional"
                              : "Calculado"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Los saldos iniciales sin precio y las devoluciones o ajustes sin
            costo de origen mantienen la valoración pendiente. Los traslados
            internos conservan el valor y no cuentan como nuevas compras.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Valoración al final de {month}</CardTitle>
          <p className="text-lg font-semibold">
            Valor identificado: {formatCop(closingValue)}
          </p>
          <p className="text-sm text-muted-foreground">
            {closingPending} material(es) con valoración pendiente, excluidos de
            este total.
          </p>
          <p className="text-sm text-muted-foreground">
            Reconstrucción según la fecha operativa y los costos vigentes. Para
            el mes actual muestra lo registrado hasta hoy. Una corrección
            posterior puede cambiar este reporte; no constituye un cierre
            contable bloqueado.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Cantidad al cierre</TableHead>
                <TableHead>Promedio al cierre</TableHead>
                <TableHead>Valor al cierre</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleMaterials.map((m) => {
                const b = monthlyBalances.get(m.id);
                return (
                  <TableRow key={m.id}>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>
                      {amount(b?.quantity ?? 0)} {m.unit_of_measure}
                    </TableCell>
                    <TableCell>{formatCop(b?.average ?? null)}</TableCell>
                    <TableCell>{formatCop(b ? b.value : 0)}</TableCell>
                    <TableCell>
                      {b?.issue
                        ? "Revisar movimientos"
                        : b?.value === null
                          ? "Faltan costos"
                          : b?.provisional
                            ? "Provisional"
                            : "Calculado"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <MixCalculator
        materials={materials
          .filter((m) => m.active)
          .map((m) => ({
            id: m.id,
            name: m.name,
            unit: m.unit_of_measure,
            cost: balances.get(m.id)?.average ?? null,
            provisional: balances.get(m.id)?.provisional ?? false,
          }))}
      />
      <Card>
        <CardHeader>
          <CardTitle>HISTORIAL DE ENTRADAS Y COSTOS · {historyPeriod}</CardTitle>
          <div>
            <CostExport
              month={historyPeriod}
              rows={filtered.map((m) => {
                const c = prices.get(m.id),
                  material = materials.find((a) => a.id === m.material_id);
                return [
                  c?.purchase_date ?? m.effective_date,
                  material?.name ?? "",
                  material?.unit_of_measure ?? "",
                  m.quantity,
                  c?.supplier ?? "",
                  c?.invoice ?? m.reference_doc ?? "",
                  c?.shipment ?? "",
                  c?.total_cop ?? null,
                  c ? c.total_cop / m.quantity : null,
                  !c
                    ? "Sin precio"
                    : c.status === "confirmed"
                      ? "Confirmado"
                      : "Provisional",
                ];
              })}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {filtered.length} entrada(s). Completar un costo no vuelve a
            ingresar cantidades al inventario.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha de compra</TableHead>
                <TableHead>Material / documento</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>PRECIO / UNIDAD COP</TableHead>
                <TableHead>Total COP</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice((page - 1) * 30, page * 30).map((m) => {
                const cost = prices.get(m.id),
                  material = materials.find((a) => a.id === m.material_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      {cost?.purchase_date ?? m.effective_date}
                    </TableCell>
                    <TableCell>
                      {material?.name}
                      <span className="block text-xs text-muted-foreground">
                        {cost?.invoice ?? m.reference_doc ?? "Sin documento"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {amount(m.quantity)} {material?.unit_of_measure}
                    </TableCell>
                    <TableCell>{cost?.supplier ?? "Pendiente"}</TableCell>
                    <TableCell>{formatCop(cost ? cost.total_cop / m.quantity : null)} / {material?.unit_of_measure}</TableCell>
                    <TableCell>{formatCop(cost?.total_cop ?? null)}</TableCell>
                    <TableCell>
                      <Badge variant={!cost ? "destructive" : "secondary"}>
                        {!cost
                          ? "Sin precio"
                          : cost.status === "confirmed"
                            ? "Confirmado"
                            : "Provisional"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/inventario/costos/${m.id}`}
                        className="text-primary underline"
                      >
                        {cost ? "Ver / corregir" : "Completar precio"}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    Sin entradas para estos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="underline">
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span>
              Página {page} de {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={pageHref(page + 1)} className="underline">
                Siguiente
              </Link>
            ) : (
              <span />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
