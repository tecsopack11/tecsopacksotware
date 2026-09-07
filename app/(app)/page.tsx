import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: materials }, { data: stock }, { data: locations }, { data: openShifts }, { data: openDowntime }] =
    await Promise.all([
      supabase.from("materials").select("id, name, min_stock").eq("active", true),
      supabase.from("v_inventory_stock").select("material_id, location_id, quantity"),
      supabase.from("locations").select("id, type"),
      supabase
        .from("shift_instances")
        .select("id, machines(name)")
        .eq("status", "abierto"),
      supabase
        .from("machine_downtime_events")
        .select("id, machines(name)")
        .is("end_time", null),
    ]);

  // El mínimo se compara solo contra lo que hay en Bodega, no contra el total
  // de la planta (igual que en /inventario/materia-prima): lo que ya salió a
  // producción no sirve para decidir si hace falta comprar.
  const bodegaLocationIds = new Set(
    (locations ?? []).filter((l) => l.type === "bodega").map((l) => l.id),
  );
  const totalsByMaterialBodega = new Map<string, number>();
  for (const row of stock ?? []) {
    if (!row.material_id || !row.location_id || !bodegaLocationIds.has(row.location_id)) continue;
    totalsByMaterialBodega.set(
      row.material_id,
      (totalsByMaterialBodega.get(row.material_id) ?? 0) + Number(row.quantity),
    );
  }

  const lowStock = (materials ?? []).filter((m) => {
    const total = totalsByMaterialBodega.get(m.id) ?? 0;
    return m.min_stock > 0 && total < m.min_stock;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panel general</h1>
        <p className="text-muted-foreground">Estado de inventario y máquinas en tiempo real.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Materiales bajo mínimo</CardDescription>
            <CardTitle className="text-3xl">{lowStock.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/inventario/materia-prima?area=bodega"
              className="text-sm text-primary hover:underline"
            >
              Ver inventario
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Turnos abiertos</CardDescription>
            <CardTitle className="text-3xl">{openShifts?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/maquinas" className="text-sm text-primary hover:underline">
              Ver máquinas
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paros activos</CardDescription>
            <CardTitle className="text-3xl">{openDowntime?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/oee" className="text-sm text-primary hover:underline">
              Ver OEE
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Materiales activos</CardDescription>
            <CardTitle className="text-3xl">{materials?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/admin/materiales" className="text-sm text-primary hover:underline">
              Ver catálogo
            </Link>
          </CardContent>
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Materiales bajo el mínimo</CardTitle>
            <CardDescription>Existencia en Bodega</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStock.map((m) => (
              <Badge key={m.id} variant="destructive">
                {m.name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
