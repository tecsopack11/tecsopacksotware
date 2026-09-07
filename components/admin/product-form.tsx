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
import { crearProducto, type ActionState } from "@/lib/actions/admin";

const initialState: ActionState = { error: null };

export function ProductForm() {
  const [state, formAction, pending] = useActionState(crearProducto, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo producto</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input id="code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit_of_measure">Unidad</Label>
            <Select
              name="unit_of_measure"
              defaultValue="unidad"
              items={{ kg: "kg", g: "g", ton: "ton", bulto: "bulto", unidad: "unidad", "cuñete": "cuñete" }}
            >
              <SelectTrigger id="unit_of_measure">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="g">g</SelectItem>
                <SelectItem value="ton">ton</SelectItem>
                <SelectItem value="bulto">bulto</SelectItem>
                <SelectItem value="unidad">unidad</SelectItem>
                <SelectItem value="cuñete">cuñete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_stock">Stock mínimo</Label>
            <Input id="min_stock" name="min_stock" type="number" step="0.01" min="0" defaultValue={0} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Crear producto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
