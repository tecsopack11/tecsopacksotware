"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { confirmarRecepcion, type ActionState } from "@/lib/actions/inventory";

const initialState: ActionState = { error: null };

export function ConfirmReceiptButton({ movementId }: { movementId: string }) {
  const [state, formAction, pending] = useActionState(confirmarRecepcion, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="movement_id" value={movementId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Confirmando..." : "Confirmar recepción"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
