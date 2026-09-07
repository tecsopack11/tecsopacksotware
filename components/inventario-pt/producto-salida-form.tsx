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
import { crearProductoSalida, type ActionState } from "@/lib/actions/product-inventory";

export type ProductStockLine = {
  key: string;
  product_id: string;
  from_location_id: string;
  quantity: number;
  label: string;
  unit: string;
};

const initialState: ActionState = { error: null };

export function ProductoSalidaForm({ stockLines }: { stockLines: ProductStockLine[] }) {
  const [state, formAction, pending] = useActionState(crearProductoSalida, initialState);
  const [selectedKey, setSelectedKey] = useState<string>("");

  const selected = useMemo(
    () => stockLines.find((s) => s.key === selectedKey),
    [stockLines, selectedKey],
  );

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Salida de producto terminado</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stock_line">Producto / almacén de origen</Label>
            <Select
              value={selectedKey}
              onValueChange={(value) => setSelectedKey(value ?? "")}
              items={Object.fromEntries(stockLines.map((s) => [s.key, s.label]))}
              required
            >
              <SelectTrigger id="stock_line">
                <SelectValue placeholder="Selecciona el producto a despachar" />
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

          <input type="hidden" name="product_id" value={selected?.product_id ?? ""} />
          <input type="hidden" name="from_location_id" value={selected?.from_location_id ?? ""} />

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
            <Label htmlFor="reference_doc">Documento de referencia</Label>
            <Input id="reference_doc" name="reference_doc" placeholder="Factura, remisión..." />
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
            {pending ? "Guardando..." : "Registrar salida"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
