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
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
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

export function SalidaForm({
  stockLines,
  destinations,
  redirectTo,
}: {
  stockLines: StockLine[];
  destinations: Option[];
  redirectTo?: "/inventario/materia-prima" | "/planta";
}) {
  const [state, formAction, pending] = useActionState(crearSalidaTraslado, initialState);
  const [selectedKey, setSelectedKey] = useState<string>("");

  const stockLineItems = useMemo(
    () => stockLines.map((s) => ({ value: s.key, label: s.label })),
    [stockLines],
  );
  const selectedStockItem = useMemo(
    () => stockLineItems.find((i) => i.value === selectedKey) ?? null,
    [stockLineItems, selectedKey],
  );
  const destinationItems = useMemo(
    () => destinations.map((d) => ({ value: d.id, label: d.label })),
    [destinations],
  );

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
          {redirectTo && <input type="hidden" name="redirect_to" value={redirectTo} />}
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
            <Combobox
              items={stockLineItems}
              value={selectedStockItem}
              onValueChange={(item) => setSelectedKey(item?.value ?? "")}
            >
              <ComboboxTrigger id="stock_line">
                <ComboboxValue placeholder="Selecciona el material a mover" />
              </ComboboxTrigger>
              <ComboboxContent
                searchPlaceholder="Buscar material, lote o ubicación..."
                emptyMessage="No se encontraron materiales."
              >
                {(item: { value: string; label: string }) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxContent>
            </Combobox>
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
            <Combobox items={destinationItems} name="to_location_id">
              <ComboboxTrigger id="to_location_id">
                <ComboboxValue placeholder="Selecciona destino (traslado/consumo)" />
              </ComboboxTrigger>
              <ComboboxContent
                searchPlaceholder="Buscar ubicación..."
                emptyMessage="No se encontraron ubicaciones."
              >
                {(item: { value: string; label: string }) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxContent>
            </Combobox>
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
