import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AbrirTurnoForm,
  CerrarTurnoButton,
  IniciarParoForm,
  CerrarParoButton,
  ProduccionForm,
} from "@/components/maquinas/machine-controls";

export const dynamic = "force-dynamic";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const { machineId } = await params;
  const supabase = await createClient();

  const { data: machine } = await supabase
    .from("machines")
    .select("id, name, code, machine_type, ideal_run_rate_per_hour")
    .eq("id", machineId)
    .single();

  if (!machine) notFound();

  const [{ data: openShift }, { data: shifts }, { data: reasons }, { data: recentProduction }] =
    await Promise.all([
      supabase
        .from("shift_instances")
        .select("id, actual_start, shift_catalog(name)")
        .eq("machine_id", machineId)
        .eq("status", "abierto")
        .maybeSingle(),
      supabase.from("shift_catalog").select("id, name").eq("active", true).order("start_time"),
      supabase.from("downtime_reasons").select("id, name, category").eq("active", true).order("name"),
      supabase
        .from("production_counts")
        .select("good_qty, reject_qty, recorded_at")
        .eq("machine_id", machineId)
        .order("recorded_at", { ascending: false })
        .limit(10),
    ]);

  const openDowntime = openShift
    ? (
        await supabase
          .from("machine_downtime_events")
          .select("id, start_time, downtime_reasons(name)")
          .eq("machine_id", machineId)
          .is("end_time", null)
          .maybeSingle()
      ).data
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{machine.name}</h1>
        <p className="text-muted-foreground">
          {machine.code} · {machine.machine_type ?? "—"}
        </p>
      </div>

      {!openShift && (
        <AbrirTurnoForm
          machineId={machine.id}
          shifts={(shifts ?? []).map((s) => ({ id: s.id, label: s.name }))}
        />
      )}

      {openShift && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Turno en curso
                {openDowntime ? (
                  <Badge variant="destructive">Paro activo</Badge>
                ) : (
                  <Badge>Produciendo</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {openShift.shift_catalog?.name} · inició{" "}
                {openShift.actual_start && new Date(openShift.actual_start).toLocaleTimeString("es-CL")}
              </div>
              <CerrarTurnoButton shiftInstanceId={openShift.id} machineId={machine.id} />
            </CardContent>
          </Card>

          {openDowntime ? (
            <Card>
              <CardHeader>
                <CardTitle>Paro en curso</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  {openDowntime.downtime_reasons?.name} · desde{" "}
                  {new Date(openDowntime.start_time).toLocaleTimeString("es-CL")}
                </div>
                <CerrarParoButton downtimeId={openDowntime.id} />
              </CardContent>
            </Card>
          ) : (
            <IniciarParoForm
              shiftInstanceId={openShift.id}
              machineId={machine.id}
              reasons={(reasons ?? []).map((r) => ({ id: r.id, label: r.name }))}
            />
          )}

          <ProduccionForm shiftInstanceId={openShift.id} machineId={machine.id} />
        </>
      )}

      {recentProduction && recentProduction.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimos conteos registrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recentProduction.map((p, i) => (
              <div key={i} className="flex justify-between border-b border-border pb-1 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(p.recorded_at).toLocaleTimeString("es-CL")}
                </span>
                <span>
                  {p.good_qty} buenas / {p.reject_qty} rechazadas
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
