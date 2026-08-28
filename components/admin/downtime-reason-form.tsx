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
import { crearMotivoParo, type ActionState } from "@/lib/actions/admin";

const initialState: ActionState = { error: null };

export function DowntimeReasonForm() {
  const [state, formAction, pending] = useActionState(crearMotivoParo, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo motivo de paro</CardTitle>
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
            <Label htmlFor="category">Categoría</Label>
            <Select
              name="category"
              defaultValue="no_planeado"
              items={{ planeado: "Planeado", no_planeado: "No planeado" }}
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planeado">Planeado</SelectItem>
                <SelectItem value="no_planeado">No planeado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3 space-y-2">
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Crear motivo"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
