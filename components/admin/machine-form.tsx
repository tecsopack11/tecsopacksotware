"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { crearMaquina, type ActionState } from "@/lib/actions/admin";

const initialState: ActionState = { error: null };

export function MachineForm() {
  const [state, formAction, pending] = useActionState(crearMaquina, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva máquina</CardTitle>
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
            <Label htmlFor="machine_type">Tipo</Label>
            <Input id="machine_type" name="machine_type" placeholder="Inyección, extrusión..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ideal_run_rate_per_hour">Tasa ideal (piezas/hora)</Label>
            <Input id="ideal_run_rate_per_hour" name="ideal_run_rate_per_hour" type="number" step="0.01" min="0" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Crear máquina"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
