"use client";

import { useActionState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  abrirTurno,
  cerrarTurno,
  iniciarParo,
  cerrarParo,
  registrarProduccion,
  type ActionState,
} from "@/lib/actions/machines";

const initialState: ActionState = { error: null };

type Option = { id: string; label: string };

function toItems(options: Option[]) {
  return Object.fromEntries(options.map((o) => [o.id, o.label]));
}

export function AbrirTurnoForm({ machineId, shifts }: { machineId: string; shifts: Option[] }) {
  const [state, formAction, pending] = useActionState(abrirTurno, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Abrir turno</CardTitle>
        <CardDescription>No hay un turno abierto en esta máquina.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="machine_id" value={machineId} />
          <div className="space-y-2">
            <Label htmlFor="shift_id">Turno</Label>
            <Select name="shift_id" items={toItems(shifts)} required>
              <SelectTrigger id="shift_id">
                <SelectValue placeholder="Selecciona el turno" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Abriendo..." : "Abrir turno"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function CerrarTurnoButton({
  shiftInstanceId,
  machineId,
}: {
  shiftInstanceId: string;
  machineId: string;
}) {
  const [state, formAction, pending] = useActionState(cerrarTurno, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="shift_instance_id" value={shiftInstanceId} />
      <input type="hidden" name="machine_id" value={machineId} />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Cerrando..." : "Cerrar turno"}
      </Button>
    </form>
  );
}

export function IniciarParoForm({
  shiftInstanceId,
  machineId,
  reasons,
}: {
  shiftInstanceId: string;
  machineId: string;
  reasons: Option[];
}) {
  const [state, formAction, pending] = useActionState(iniciarParo, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar paro</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="shift_instance_id" value={shiftInstanceId} />
          <input type="hidden" name="machine_id" value={machineId} />
          <div className="space-y-2">
            <Label htmlFor="reason_id">Motivo</Label>
            <Select name="reason_id" items={toItems(reasons)} required>
              <SelectTrigger id="reason_id">
                <SelectValue placeholder="Selecciona un motivo" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "Registrando..." : "Iniciar paro"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function CerrarParoButton({ downtimeId }: { downtimeId: string }) {
  const [state, formAction, pending] = useActionState(cerrarParo, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="downtime_id" value={downtimeId} />
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Cerrando..." : "Cerrar paro"}
      </Button>
    </form>
  );
}

export function ProduccionForm({
  shiftInstanceId,
  machineId,
}: {
  shiftInstanceId: string;
  machineId: string;
}) {
  const [state, formAction, pending] = useActionState(registrarProduccion, initialState);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar producción</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="shift_instance_id" value={shiftInstanceId} />
          <input type="hidden" name="machine_id" value={machineId} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="good_qty">Piezas buenas</Label>
              <Input id="good_qty" name="good_qty" type="number" min="0" defaultValue={0} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject_qty">Piezas rechazadas</Label>
              <Input id="reject_qty" name="reject_qty" type="number" min="0" defaultValue={0} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reject_reason">Motivo de rechazo (si aplica)</Label>
            <Input id="reject_reason" name="reject_reason" />
          </div>
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Registrar conteo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
