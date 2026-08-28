import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateOee, formatPercent } from "@/lib/oee/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function MachineOeePage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const { machineId } = await params;
  const supabase = await createClient();

  const { data: machine } = await supabase
    .from("machines")
    .select("id, name")
    .eq("id", machineId)
    .single();
  if (!machine) notFound();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: shiftInstances } = await supabase
    .from("shift_instances")
    .select("id, run_date, shift_catalog(name)")
    .eq("machine_id", machineId)
    .gte("run_date", sevenDaysAgo)
    .not("actual_start", "is", null)
    .order("run_date", { ascending: false });

  const shiftIds = (shiftInstances ?? []).map((s) => s.id);

  const [{ data: oeeRows }, { data: downtimeEvents }] = await Promise.all([
    shiftIds.length > 0
      ? supabase.from("v_oee_by_shift").select("*").in("shift_instance_id", shiftIds)
      : Promise.resolve({ data: [] }),
    shiftIds.length > 0
      ? supabase
          .from("machine_downtime_events")
          .select("start_time, end_time, downtime_reasons(name)")
          .in("shift_instance_id", shiftIds)
      : Promise.resolve({ data: [] }),
  ]);

  const oeeByShift = new Map((oeeRows ?? []).map((r) => [r.shift_instance_id, r]));

  const pareto = new Map<string, number>();
  for (const e of downtimeEvents ?? []) {
    const seconds =
      (new Date(e.end_time ?? new Date()).getTime() - new Date(e.start_time).getTime()) / 1000;
    const name = e.downtime_reasons?.name ?? "Sin motivo";
    pareto.set(name, (pareto.get(name) ?? 0) + seconds);
  }
  const paretoSorted = Array.from(pareto.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{machine.name} — OEE (7 días)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>OEE por turno</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead className="text-right">Disponibilidad</TableHead>
                <TableHead className="text-right">Rendimiento</TableHead>
                <TableHead className="text-right">Calidad</TableHead>
                <TableHead className="text-right">OEE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(shiftInstances ?? []).map((s) => {
                const row = oeeByShift.get(s.id);
                if (!row) return null;
                const result = calculateOee({
                  planned_production_seconds: row.planned_production_seconds ?? 0,
                  run_seconds: row.run_seconds ?? 0,
                  good_qty: row.good_qty ?? 0,
                  reject_qty: row.reject_qty ?? 0,
                  ideal_run_rate_per_hour: row.ideal_run_rate_per_hour,
                });
                return (
                  <TableRow key={s.id}>
                    <TableCell>{s.run_date}</TableCell>
                    <TableCell>{s.shift_catalog?.name}</TableCell>
                    <TableCell className="text-right">{formatPercent(result.availability)}</TableCell>
                    <TableCell className="text-right">{formatPercent(result.performance)}</TableCell>
                    <TableCell className="text-right">{formatPercent(result.quality)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPercent(result.oee)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pareto de motivos de paro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {paretoSorted.length === 0 && (
            <p className="text-muted-foreground text-sm">Sin paros registrados en este período.</p>
          )}
          {paretoSorted.map(([name, seconds]) => {
            const maxSeconds = paretoSorted[0][1];
            const pct = (seconds / maxSeconds) * 100;
            return (
              <div key={name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{name}</span>
                  <span className="text-muted-foreground">{Math.round(seconds / 60)} min</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
