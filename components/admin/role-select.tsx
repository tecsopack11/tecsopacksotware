"use client";

import { useActionState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actualizarRol, type ActionState } from "@/lib/actions/admin";
import type { Database } from "@/lib/types/database.types";

type Role = Database["public"]["Enums"]["user_role"];

const initialState: ActionState = { error: null };

export function RoleSelect({ profileId, currentRole }: { profileId: string; currentRole: Role }) {
  const [state, formAction] = useActionState(actualizarRol, initialState);

  const formId = `role-form-${profileId}`;

  return (
    <form id={formId} action={formAction}>
      <input type="hidden" name="profile_id" value={profileId} />
      <Select
        name="role"
        defaultValue={currentRole}
        items={{ operario: "Operario", supervisor: "Supervisor", admin: "Administrador" }}
        onValueChange={() => {
          const form = document.getElementById(formId) as HTMLFormElement | null;
          form?.requestSubmit();
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="operario">Operario</SelectItem>
          <SelectItem value="supervisor">Supervisor</SelectItem>
          <SelectItem value="admin">Administrador</SelectItem>
        </SelectContent>
      </Select>
      {state.error && <p className="text-destructive text-xs mt-1">{state.error}</p>}
    </form>
  );
}
