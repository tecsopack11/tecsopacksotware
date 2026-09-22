import { randomUUID } from "node:crypto";
import { getCostSnapshot } from "@/lib/costs/data";
import { bogotaDate } from "@/lib/costs/schema";
import { CostForm } from "@/components/costos/cost-form";

export const dynamic = "force-dynamic";
export default async function PurchasePage() {
  const { snapshot, error } = await getCostSnapshot();
  if (!snapshot)
    return (
      <p role="alert" className="text-destructive">
        {error}
      </p>
    );
  const materials = snapshot.materials
    .filter((m) => m.active)
    .sort((a, b) => a.name.localeCompare(b.name));
  const locations = snapshot.locations.filter(
    (l) => l.active && ["bodega", "piso"].includes(l.type),
  );
  if (!materials.length || !locations.length)
    return <p>Primero registra materiales y una ubicación de bodega o piso.</p>;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Compra de materia prima</h1>
        <p className="text-muted-foreground">
          Registra una nueva recepción con su costo completo. Si ya ingresaste
          la cantidad en el registro diario, completa el costo de esa entrada
          desde el historial.
        </p>
      </div>
      <CostForm
        today={bogotaDate()}
        requestId={randomUUID()}
        materials={materials}
        locations={locations}
      />
    </div>
  );
}
