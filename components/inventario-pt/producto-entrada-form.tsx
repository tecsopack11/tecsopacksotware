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
import { crearProductoEntrada, type ActionState } from "@/lib/actions/product-inventory";

type Option = { id: string; label: string };

const initialState: ActionState = { error: null };

function toItems(options: Option[]) {
  return Object.fromEntries(options.map((o) => [o.id, o.label]));
}

export function ProductoEntradaForm({
  products,
  locations,
  defaultLocationId,
  defaultProductId,
  initialInventory = false,
}: {
  products: Option[];
  locations: Option[];
  defaultLocationId?: string;
  defaultProductId?: string;
  initialInventory?: boolean;
}) {
  const [state, formAction, pending] = useActionState(crearProductoEntrada, initialState);

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{initialInventory ? "REGISTRAR EXISTENCIA INICIAL" : "Nueva entrada de producto terminado"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product_id">Producto</Label>
            <Select name="product_id" items={toItems(products)} required defaultValue={defaultProductId}>
              <SelectTrigger id="product_id">
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad (unidad del producto)</Label>
              <Input id="quantity" name="quantity" type="number" step="0.001" min="0.001" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to_location_id">Almacén</Label>
              <Select
                name="to_location_id"
                items={toItems(locations)}
                required
                defaultValue={defaultLocationId}
              >
                <SelectTrigger id="to_location_id">
                  <SelectValue placeholder="Selecciona almacén" />
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

          {initialInventory && <p className="text-sm text-muted-foreground">Digita la existencia física en la unidad del producto. Los genéricos del Excel se registran en UNIDADES: no copies la cantidad por paquete o bulto como si fuera la existencia. Este registro suma una entrada al almacén.</p>}

          <div className="space-y-2">
            <Label htmlFor="reference_doc">Documento de referencia</Label>
            <Input id="reference_doc" name="reference_doc" placeholder="Orden de producción..." defaultValue={initialInventory ? "INVENTARIO INICIAL PT" : undefined} />
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
