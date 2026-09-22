"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  eliminarMaterial,
  eliminarProducto,
  type ActionState,
} from "@/lib/actions/admin";

const initialState: ActionState = { error: null };

export function CatalogDeleteButton({
  id,
  name,
  kind,
}: {
  id: string;
  name: string;
  kind: "material" | "producto";
}) {
  const action = kind === "material" ? eliminarMaterial : eliminarProducto;
  const [state, formAction, pending] = useActionState(action, initialState);
  const label = kind === "material" ? "material" : "producto";

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button type="button" variant="destructive" size="sm" />}
      >
        Eliminar
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {label}</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que deseas eliminar “{name}”? Esta acción no se puede deshacer.
              Si tiene movimientos asociados, el sistema impedirá eliminarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state.error && (
            <p role="alert" className="py-3 text-sm text-destructive">
              {state.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Volver</AlertDialogCancel>
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              {pending ? "Eliminando..." : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
