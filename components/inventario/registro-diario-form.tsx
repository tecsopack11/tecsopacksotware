"use client";

import { useActionState, useMemo, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { crearRegistroDiario, type ActionState } from "@/lib/actions/inventory";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Material = {
  id: string;
  name: string;
  code: string;
  unit: string;
  category: string;
};

type Location = { id: string; name: string };
type Stock = Record<string, Record<string, number>>;
type Quantities = Record<string, { entry: string; exit: string }>;

const CATEGORY_LABEL: Record<string, string> = {
  principal: "Materiales principales",
  pigmento: "Pigmentos",
  tinta: "Tintas",
  solvente: "Solventes",
};
const CATEGORY_ORDER = ["principal", "pigmento", "tinta", "solvente"];
const initialState: ActionState = { error: null };

function numeric(value: string) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : 0;
}

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function RegistroDiarioForm({
  materials,
  locations,
  stock,
  defaultLocationId,
  warehouseLocationId,
  defaultResponsible,
}: {
  materials: Material[];
  locations: Location[];
  stock: Stock;
  defaultLocationId: string;
  warehouseLocationId: string;
  defaultResponsible: string;
}) {
  const [state, formAction, pending] = useActionState(crearRegistroDiario, initialState);
  const [flow, setFlow] = useState(defaultLocationId);
  const [quantities, setQuantities] = useState<Quantities>({});
  const isSale = flow === "sale";
  const locationId = isSale ? warehouseLocationId : flow;

  const grouped = useMemo(
    () => CATEGORY_ORDER.map((category) => ({
      category,
      materials: materials.filter((material) => material.category === category),
    })).filter((group) => group.materials.length > 0),
    [materials],
  );

  function change(materialId: string, field: "entry" | "exit", value: string) {
    setQuantities((current) => ({
      ...current,
      [materialId]: { ...(current[materialId] ?? { entry: "", exit: "" }), [field]: value },
    }));
  }

  function changeFlow(value: string) {
    setFlow(value);
    if (value === "sale") {
      setQuantities((current) => Object.fromEntries(
        Object.entries(current).map(([id, quantity]) => [id, { ...quantity, entry: "" }]),
      ));
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card className="border-t-4 border-t-primary">
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="record_date">Fecha</Label>
            <Input id="record_date" name="record_date" type="date" defaultValue={localDate()} max={localDate()} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="responsible">Responsable</Label>
            <Input id="responsible" name="responsible" defaultValue={defaultResponsible} placeholder="Nombre" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inventory_flow">Ubicación / flujo</Label>
            <input type="hidden" name="location_id" value={locationId} />
            <input type="hidden" name="movement_kind" value={isSale ? "sale" : "regular"} />
            <Select
              items={{
                ...Object.fromEntries(locations.map((location) => [location.id, location.name])),
                sale: "Venta de MP",
              }}
              value={flow}
              onValueChange={(value) => value && changeFlow(value)}
              required
            >
              <SelectTrigger id="inventory_flow"><SelectValue /></SelectTrigger>
              <SelectContent>
                {locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}
                <SelectItem value="sale">Venta de MP</SelectItem>
              </SelectContent>
            </Select>
            {isSale && <p className="text-xs text-muted-foreground">La venta se descuenta de la bodega principal.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="observations">Observaciones</Label>
            <Input id="observations" name="observations" placeholder="Novedades del día" maxLength={500} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(260px,1fr)_repeat(5,110px)] gap-2 px-4 pb-2 text-center text-xs font-semibold text-white">
                <span />
                <span className="rounded-md bg-primary px-2 py-1.5">Inv. inicial</span>
                <span className="rounded-md bg-primary px-2 py-1.5">Entradas</span>
                <span className="rounded-md bg-ingreso px-2 py-1.5">Total</span>
                <span className="rounded-md bg-primary px-2 py-1.5">Salidas</span>
                <span className="rounded-md bg-ingreso px-2 py-1.5">Inv. final</span>
              </div>

              {grouped.map(({ category, materials: categoryMaterials }) => (
                <section key={category} className="mb-3">
                  <h2 className="mx-4 mb-1 rounded-md bg-accent px-3 py-2 text-xs font-bold uppercase text-accent-foreground">
                    {CATEGORY_LABEL[category] ?? category}
                  </h2>
                  <div className="space-y-1 px-4">
                    {categoryMaterials.map((material) => {
                      const initial = stock[locationId]?.[material.id] ?? 0;
                      const entry = numeric(quantities[material.id]?.entry ?? "");
                      const exit = numeric(quantities[material.id]?.exit ?? "");
                      const total = initial + entry;
                      const final = total - exit;
                      return (
                        <div key={material.id} className="grid grid-cols-[minmax(260px,1fr)_repeat(5,110px)] items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
                          <div>
                            <p className="font-medium leading-tight">{material.name}</p>
                            <p className="text-xs text-muted-foreground">{material.code} · Unidad: {material.unit}</p>
                          </div>
                          <Input value={initial} readOnly tabIndex={-1} className="text-center" aria-label={`Inventario inicial de ${material.name}`} />
                          <Input
                            name={`entry.${material.id}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.001"
                            placeholder="0"
                            value={quantities[material.id]?.entry ?? ""}
                            onChange={(event) => change(material.id, "entry", event.target.value)}
                            disabled={isSale}
                            className="text-center"
                            aria-label={`Entrada de ${material.name}`}
                          />
                          <Input value={total} readOnly tabIndex={-1} className="border-ingreso/30 bg-accent/60 text-center font-medium" aria-label={`Total de ${material.name}`} />
                          <Input
                            name={`exit.${material.id}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={total}
                            step="0.001"
                            placeholder="0"
                            value={quantities[material.id]?.exit ?? ""}
                            onChange={(event) => change(material.id, "exit", event.target.value)}
                            className="text-center"
                            aria-label={`Salida de ${material.name}`}
                          />
                          <Input value={final} readOnly tabIndex={-1} className="border-ingreso/30 bg-accent/60 text-center font-semibold" aria-label={`Inventario final de ${material.name}`} />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="min-w-40">
          <Save className="size-4" />{pending ? "Guardando..." : "Guardar registro"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setQuantities({})}>
          <RotateCcw className="size-4" />Limpiar
        </Button>
      </div>
    </form>
  );
}
