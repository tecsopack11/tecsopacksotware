"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cancelarMovimientoProducto, type ActionState } from "@/lib/actions/product-inventory";

const initialState: ActionState = { error: null };

export function CancelProductMovementButton({ movementId }: { movementId: string }) {
  const [state, formAction, pending] = useActionState(cancelarMovimientoProducto, initialState);
  const [reason, setReason] = useState("");

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>
        Cancelar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="movement_id" value={movementId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar movimiento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no borra el registro, lo marca como cancelado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 px-1 py-2">
            <Label htmlFor="cancel_reason">Motivo</Label>
            <Input
              id="cancel_reason"
              name="cancel_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            {state.error && <p className="text-destructive text-sm">{state.error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Volver</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={pending || !reason}>
              {pending ? "Cancelando..." : "Confirmar cancelación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
