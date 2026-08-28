"use client";

import { useActionState, useMemo, useState } from "react";
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
import { crearSalidaTraslado, type ActionState } from "@/lib/actions/inventory";

export type StockLine = {
  key: string;
  material_id: string;
  lot_id: string | null;
  from_location_id: string;
  quantity: number;
  label: string;
  unit: string;
};

type Option = { id: string; label: string };

const initialState: ActionState = { error: null };

const MOVEMENT_TYPE_ITEMS = {
  traslado: "Traslado interno",
  salida: "Salida (externa)",
  consumo: "Consumo en máquina",
};

function toItems(options: { id: string; label: string }[]) {
  return Object.fromEntries(options.map((o) => [o.id, o.label]));
}

export function SalidaForm({
  stockLines,
  destinations,
}: {
  stockLines: StockLine[];
  destinations: Option[];
}) {
  const [state, formAction, pending] = useActionState(crearSalidaTraslado, initialState);
  const [selectedKey, setSelectedKey] = useState<string>("");

  const selected = useMemo(
    () => stockLines.find((s) => s.key === selectedKey),
    [stockLines, selectedKey],
  );

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Salida / Traslado de materia prima</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="movement_type">Tipo de movimiento</Label>
            <Select
              name="movement_type"
              items={MOVEMENT_TYPE_ITEMS}
              required
              defaultValue="traslado"
            >
              <SelectTrigger id="movement_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="traslado">Traslado interno</SelectItem>
                <SelectItem value="salida">Salida (externa)</SelectItem>
                <SelectItem value="consumo">Consumo en máquina</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock_line">Material / lote / ubicación de origen</Label>
            <Select
              value={selectedKey}
              onValueChange={(value) => setSelectedKey(value ?? "")}
              items={Object.fromEntries(stockLines.map((s) => [s.key, s.label]))}
              required
            >
              <SelectTrigger id="stock_line">
                <SelectValue placeholder="Selecciona el material a mover" />
              </SelectTrigger>
              <SelectContent>
                {stockLines.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Disponible: {selected.quantity.toLocaleString("es-CL")} {selected.unit}
              </p>
            )}
          </div>

          <input type="hidden" name="material_id" value={selected?.material_id ?? ""} />
          <input type="hidden" name="lot_id" value={selected?.lot_id ?? ""} />
          <input type="hidden" name="from_location_id" value={selected?.from_location_id ?? ""} />

          <div className="space-y-2">
            <Label htmlFor="to_location_id">Destino</Label>
            <Select name="to_location_id" items={toItems(destinations)}>
              <SelectTrigger id="to_location_id">
                <SelectValue placeholder="Selecciona destino (traslado/consumo)" />
              </SelectTrigger>
              <SelectContent>
                {destinations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="0.001"
              min="0.001"
              max={selected?.quantity}
              required
            />
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

          <Button type="submit" className="w-full" disabled={pending || !selected}>
            {pending ? "Guardando..." : "Registrar movimiento"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
