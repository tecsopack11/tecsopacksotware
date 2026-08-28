"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crearEntrada, type ActionState } from "@/lib/actions/inventory";

type Option = { id: string; label: string };

const initialState: ActionState = { error: null };

function toItems(options: Option[]) {
  return Object.fromEntries(options.map((o) => [o.id, o.label]));
}

export function EntradaForm({
  materials,
  locations,
  defaultLocationId,
}: {
  materials: Option[];
  locations: Option[];
  defaultLocationId?: string;
}) {
  const [state, formAction, pending] = useActionState(crearEntrada, initialState);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Nueva entrada de materia prima</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="material_id">Material</Label>
            <Select name="material_id" items={toItems(materials)} required>
              <SelectTrigger id="material_id">
                <SelectValue placeholder="Selecciona un material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lot_code">Lote</Label>
              <Input id="lot_code" name="lot_code" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Proveedor</Label>
              <Input id="supplier" name="supplier" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad</Label>
              <Input id="quantity" name="quantity" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to_location_id">Destino</Label>
              <Select
                name="to_location_id"
                items={toItems(locations)}
                required
                defaultValue={defaultLocationId}
              >
                <SelectTrigger id="to_location_id">
                  <SelectValue placeholder="Selecciona destino" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference_doc">Documento de referencia</Label>
            <Input id="reference_doc" name="reference_doc" placeholder="Remisión, orden de compra..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Input id="notes" name="notes" />
          </div>

          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando..." : "Registrar entrada"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
