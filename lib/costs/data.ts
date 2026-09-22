import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import type { CostRevision } from "./schema";
import type { Movement } from "./calculations";

export type CostSnapshot = {
  materials: {
    id: string;
    name: string;
    code: string;
    unit_of_measure: string;
    active: boolean;
  }[];
  locations: { id: string; name: string; type: string; active: boolean }[];
  movements: Movement[];
  costs: CostRevision[];
};

export async function requireCostAccess() {
  const session = await getProfile();
  if (!session) redirect("/login");
  if (
    !session.profile.active ||
    !["admin", "supervisor"].includes(session.profile.role)
  )
    redirect("/planta");
  return session;
}

export async function getCostSnapshot(): Promise<{
  snapshot: CostSnapshot | null;
  error: string | null;
}> {
  await requireCostAccess();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("material_cost_snapshot");
  if (error || !data)
    return {
      snapshot: null,
      error:
        "No se pudieron cargar los costos. Verifica que la migración 0011 esté aplicada y vuelve a intentar.",
    };
  return { snapshot: data as unknown as CostSnapshot, error: null };
}
