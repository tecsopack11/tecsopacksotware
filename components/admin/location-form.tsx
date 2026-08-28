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
import { crearUbicacion, type ActionState } from "@/lib/actions/admin";

const initialState: ActionState = { error: null };

export function LocationForm() {
  const [state, formAction, pending] = useActionState(crearUbicacion, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva ubicación</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="code">Código</Label>
            <Input id="code" name="code" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select
              name="type"
              defaultValue="bodega"
              items={{ bodega: "Bodega", piso: "Piso", externo: "Externo", merma: "Merma" }}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bodega">Bodega</SelectItem>
                <SelectItem value="piso">Piso</SelectItem>
                <SelectItem value="externo">Externo</SelectItem>
                <SelectItem value="merma">Merma</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              Las ubicaciones tipo &quot;máquina&quot; se crean automáticamente al registrar una máquina.
            </p>
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Crear ubicación"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
