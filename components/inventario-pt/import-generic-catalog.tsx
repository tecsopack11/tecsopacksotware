"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { importarGenericos, type ImportState } from "@/lib/actions/generic-products";

const initialState: ImportState = { error: null, message: null };

export function ImportGenericCatalog() {
  const [state, action, pending] = useActionState(importarGenericos, initialState);
  return (
    <form action={action} className="space-y-2">
      <Button disabled={pending} type="submit">
        {pending ? "CARGANDO…" : "AGREGAR GENÉRICOS AL CATÁLOGO"}
      </Button>
      <p role="status" className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        {state.error ?? state.message}
      </p>
    </form>
  );
}
