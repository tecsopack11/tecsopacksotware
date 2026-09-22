"use client";

import { useActionState, useState } from "react";
import { saveMaterialCost } from "@/lib/actions/material-costs";
import { landedCost, formatCop } from "@/lib/costs/calculations";
import type { CostRevision } from "@/lib/costs/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Option = { id: string; name: string; unit_of_measure?: string };
const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function CostForm({
  movementId,
  quantity: initialQuantity = 0,
  unit = "unidad",
  current,
  today,
  requestId,
  materials = [],
  locations = [],
}: {
  movementId?: string;
  quantity?: number;
  unit?: string;
  current?: CostRevision;
  today: string;
  requestId?: string;
  materials?: Option[];
  locations?: Option[];
}) {
  const [state, action, pending] = useActionState(saveMaterialCost, {
    error: null,
  });
  const [quantity, setQuantity] = useState(initialQuantity);
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [currency, setCurrency] = useState(current?.currency ?? "COP");
  const [amounts, setAmounts] = useState({
    unit_price: current?.unit_price ?? 0,
    exchange_rate: current?.exchange_rate ?? 1,
    discount: current?.discount ?? 0,
    freight: current?.freight ?? 0,
    insurance: current?.insurance ?? 0,
    duties: current?.duties ?? 0,
    other_costs: current?.other_costs ?? 0,
  });
  const selectedUnit = movementId
    ? unit
    : (materials.find((m) => m.id === materialId)?.unit_of_measure ?? "unidad");
  const result = landedCost(quantity, amounts);
  const numericFields = [
    ["unit_price", `Precio por ${selectedUnit} (${currency})`],
    ["exchange_rate", `COP por 1 ${currency}`],
    ["discount", `Descuento total (${currency})`],
    ["freight", "Flete asignado (COP)"],
    ["insurance", "Seguro asignado (COP)"],
    ["duties", "Aranceles e impuestos no recuperables (COP)"],
    ["other_costs", "Otros gastos asignados (COP)"],
  ] as const;
  return (
    <form action={action} className="space-y-5">
      <input
        type="hidden"
        name="mode"
        value={movementId ? "revision" : "purchase"}
      />
      <input type="hidden" name="movement_id" value={movementId ?? ""} />
      <input
        type="hidden"
        name="expected_revision"
        value={current?.revision ?? 0}
      />
      <input type="hidden" name="request_id" value={requestId ?? ""} />
      {!movementId && (
        <Card>
          <CardHeader>
            <CardTitle>Material recibido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="material_id">Material</Label>
              <select
                id="material_id"
                name="material_id"
                required
                className={selectClass}
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit_of_measure})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Cantidad ({selectedUnit})</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="0.001"
                step="0.001"
                max="999999999"
                required
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lot_code">Lote</Label>
              <Input id="lot_code" name="lot_code" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to_location_id">Destino</Label>
              <select
                id="to_location_id"
                name="to_location_id"
                className={selectClass}
                required
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Compra y soporte</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="purchase_date">Fecha de compra</Label>
            <Input
              id="purchase_date"
              name="purchase_date"
              type="date"
              defaultValue={current?.purchase_date ?? today}
              max={today}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier">Proveedor</Label>
            <Input
              id="supplier"
              name="supplier"
              defaultValue={current?.supplier}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice">Factura / documento</Label>
            <Input
              id="invoice"
              name="invoice"
              defaultValue={current?.invoice}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipment">Contenedor / embarque (opcional)</Label>
            <Input
              id="shipment"
              name="shipment"
              defaultValue={current?.shipment}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Moneda de compra</Label>
            <select
              id="currency"
              name="currency"
              className={selectClass}
              value={currency}
              onChange={(e) => {
                const value = e.target.value as typeof currency;
                setCurrency(value);
                if (value === "COP")
                  setAmounts((a) => ({ ...a, exchange_rate: 1 }));
              }}
            >
              {["COP", "USD", "EUR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado del costo</Label>
            <select
              id="status"
              name="status"
              defaultValue={current?.status ?? "provisional"}
              className={selectClass}
            >
              <option value="provisional">
                Provisional — faltan datos o gastos por validar
              </option>
              <option value="confirmed">Confirmado — costo completo</option>
            </select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Precio y gastos de esta entrada</CardTitle>
          <p className="text-sm text-muted-foreground">
            Asigna únicamente la parte de los gastos que corresponde a este
            material. Un gasto compartido del contenedor se distribuye entre sus
            entradas; no se repite completo en cada una.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {numericFields.map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                name={key}
                type="number"
                step={
                  key === "unit_price" || key === "exchange_rate"
                    ? "0.000001"
                    : "0.01"
                }
                min={
                  key === "unit_price" || key === "exchange_rate"
                    ? "0.000001"
                    : "0"
                }
                required
                readOnly={key === "exchange_rate" && currency === "COP"}
                value={amounts[key]}
                onChange={(e) =>
                  setAmounts((a) => ({ ...a, [key]: Number(e.target.value) }))
                }
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="recoverable_tax">
              Impuestos recuperables (COP)
            </Label>
            <Input
              id="recoverable_tax"
              name="recoverable_tax"
              type="number"
              min="0"
              step="0.01"
              defaultValue={current?.recoverable_tax ?? 0}
              required
            />
            <p className="text-xs text-muted-foreground">
              Se registran como referencia y se excluyen del costo del material.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="allocation_note">Distribución de gastos</Label>
            <Input
              id="allocation_note"
              name="allocation_note"
              defaultValue={current?.allocation_note}
              maxLength={1000}
              placeholder="Ej.: 40% del flete del contenedor, según el peso de esta recepción"
            />
          </div>
        </CardContent>
      </Card>
      <Card className="border-primary/40">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="text-sm">
            Mercancía neta en COP
            <p className="text-xl font-semibold">
              {formatCop(result?.goods ?? null)}
            </p>
          </div>
          <div className="text-sm">
            Costo total de la entrada
            <p className="text-xl font-semibold">
              {formatCop(result?.total ?? null)}
            </p>
          </div>
          <div className="text-sm">
            Costo por {selectedUnit}
            <p className="text-xl font-semibold">
              {formatCop(result?.unit ?? null)}
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2">
        <Label htmlFor="reason">
          {current ? "Motivo de la corrección" : "Observación del registro"}
        </Label>
        <Input
          id="reason"
          name="reason"
          required
          minLength={3}
          maxLength={1000}
          defaultValue={current ? "" : "Registro inicial de compra"}
          placeholder="Ej.: llegó la factura final del flete"
        />
        <p className="text-xs text-muted-foreground">
          Se conserva cada versión con su fecha y responsable.
        </p>
      </div>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending || !result}>
        {pending
          ? "Guardando..."
          : movementId
            ? "Guardar costo"
            : "Registrar entrada y costo"}
      </Button>
    </form>
  );
}
