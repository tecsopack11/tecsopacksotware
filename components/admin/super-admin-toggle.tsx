"use client";

import { useActionState } from "react";
import { Switch } from "@/components/ui/switch";
import { actualizarSuperAdmin, type ActionState } from "@/lib/actions/admin";

const initialState: ActionState = { error: null };

export function SuperAdminToggle({
  profileId,
  isSuperAdmin,
  disabled,
}: {
  profileId: string;
  isSuperAdmin: boolean;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(actualizarSuperAdmin, initialState);
  const formId = `super-admin-form-${profileId}`;

  return (
    <form id={formId} action={formAction}>
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="is_super_admin" value={String(!isSuperAdmin)} />
      <Switch
        checked={isSuperAdmin}
        disabled={disabled}
        onCheckedChange={() => {
          const form = document.getElementById(formId) as HTMLFormElement | null;
          form?.requestSubmit();
        }}
      />
      {state.error && <p className="text-destructive text-xs mt-1">{state.error}</p>}
    </form>
  );
}
