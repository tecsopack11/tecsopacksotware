"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveQuickMaterialPurchase } from "@/lib/actions/material-costs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Material = { id: string; name: string; code: string; unit: string };

export function QuickCostEntry({
  materials,
  locationId,
  today,
  requestId,
}: {
  materials: Material[];
  locationId: string;
  today: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(saveQuickMaterialPurchase, {
    error: null,
  });
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const material = materials.find((item) => item.id === materialId);

  return (
    <Card className="border-primary/40 bg-primary/[0.025]">
      <CardHeader>
        <CardTitle>REGISTRAR NUEVA COMPRA Y COSTO</CardTitle>
        <p className="text-sm text-muted-foreground">
          Guarda cada compra por separado. El promedio se recalcula ponderando el
          precio por la cantidad comprada. Sin límite de compras por material.
          Si ya registró la entrada en inventario, complete su precio desde el historial para no duplicar existencias.
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="to_location_id" value={locationId} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_160px_200px_170px]">
            <div className="space-y-2">
              <Label htmlFor="quick-material">Materia prima</Label>
              <select
                id="quick-material"
                name="material_id"
                required
                value={materialId}
                onChange={(event) => setMaterialId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {materials.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-quantity">Cantidad ({material?.unit ?? "unidad"})</Label>
              <Input id="quick-quantity" name="quantity" type="number" min="0.001" step="0.001" placeholder="0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-price">Costo COP por {material?.unit ?? "unidad"}</Label>
              <Input id="quick-price" name="unit_price" type="number" min="0.01" step="0.01" placeholder="$ 0" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-date">Fecha de compra</Label>
              <Input id="quick-date" name="purchase_date" type="date" defaultValue={today} max={today} required />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-supplier">Proveedor (opcional)</Label>
              <Input id="quick-supplier" name="supplier" maxLength={200} placeholder="Nombre del proveedor" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-invoice">Factura o documento (opcional)</Label>
              <Input id="quick-invoice" name="invoice" maxLength={200} placeholder="Número de factura" />
            </div>
          </div>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || !materialId}>
              {pending ? "Guardando compra..." : "Guardar compra y costo"}
            </Button>
            <Button render={<Link href="/inventario/costos/compra" />} nativeButton={false} variant="outline">
              Agregar flete, impuestos u otros gastos
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
