import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function MaquinasPage() {
  const supabase = await createClient();

  const [{ data: machines }, { data: openShifts }, { data: openDowntime }] = await Promise.all([
    supabase.from("machines").select("id, name, code, machine_type").eq("active", true).order("name"),
    supabase.from("shift_instances").select("id, machine_id").eq("status", "abierto"),
    supabase.from("machine_downtime_events").select("id, machine_id").is("end_time", null),
  ]);

  const openShiftByMachine = new Set((openShifts ?? []).map((s) => s.machine_id));
  const downtimeByMachine = new Set((openDowntime ?? []).map((d) => d.machine_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Máquinas</h1>
        <p className="text-muted-foreground">Estado de turno y producción en vivo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(machines ?? []).map((m) => {
          const hasOpenShift = openShiftByMachine.has(m.id);
          const hasDowntime = downtimeByMachine.has(m.id);
          return (
            <Link key={m.id} href={`/maquinas/${m.id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {m.name}
                    {hasDowntime ? (
                      <Badge variant="destructive">Paro activo</Badge>
                    ) : hasOpenShift ? (
                      <Badge>En turno</Badge>
                    ) : (
                      <Badge variant="secondary">Sin turno</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {m.code} · {m.machine_type ?? "—"}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
