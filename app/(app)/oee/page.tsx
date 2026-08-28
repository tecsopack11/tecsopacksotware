import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calculateOee, formatPercent } from "@/lib/oee/calculations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OeePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: shiftInstances } = await supabase
    .from("shift_instances")
    .select("id, machine_id, machines(name)")
    .eq("run_date", today)
    .not("actual_start", "is", null);

  const shiftIds = (shiftInstances ?? []).map((s) => s.id);

  const { data: oeeRows } =
    shiftIds.length > 0
      ? await supabase.from("v_oee_by_shift").select("*").in("shift_instance_id", shiftIds)
      : { data: [] };

  const oeeByShift = new Map((oeeRows ?? []).map((r) => [r.shift_instance_id, r]));

  const byMachine = new Map<
    string,
    { name: string; results: ReturnType<typeof calculateOee>[] }
  >();

  for (const shift of shiftInstances ?? []) {
    const row = oeeByShift.get(shift.id);
    if (!row) continue;
    const result = calculateOee({
      planned_production_seconds: row.planned_production_seconds ?? 0,
      run_seconds: row.run_seconds ?? 0,
      good_qty: row.good_qty ?? 0,
      reject_qty: row.reject_qty ?? 0,
      ideal_run_rate_per_hour: row.ideal_run_rate_per_hour,
    });
    const machineName = shift.machines?.name ?? "—";
    const entry = byMachine.get(shift.machine_id) ?? { name: machineName, results: [] };
    entry.results.push(result);
    byMachine.set(shift.machine_id, entry);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">OEE — hoy</h1>
        <p className="text-muted-foreground">Disponibilidad × Rendimiento × Calidad por máquina.</p>
      </div>

      {byMachine.size === 0 && (
        <p className="text-muted-foreground">Aún no hay turnos con datos suficientes hoy.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from(byMachine.entries()).map(([machineId, { name, results }]) => {
          const avg = average(results);
          return (
            <Link key={machineId} href={`/oee/${machineId}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle>{name}</CardTitle>
                  <CardDescription>{results.length} turno(s) hoy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{formatPercent(avg.oee)}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>Disp. {formatPercent(avg.availability)}</div>
                    <div>Rend. {formatPercent(avg.performance)}</div>
                    <div>Cal. {formatPercent(avg.quality)}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function average(results: ReturnType<typeof calculateOee>[]) {
  const n = results.length || 1;
  return {
    availability: results.reduce((s, r) => s + r.availability, 0) / n,
    performance: results.reduce((s, r) => s + r.performance, 0) / n,
    quality: results.reduce((s, r) => s + r.quality, 0) / n,
    oee: results.reduce((s, r) => s + r.oee, 0) / n,
  };
}
