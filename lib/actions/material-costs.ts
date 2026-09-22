"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCostAccess } from "@/lib/costs/data";
import { costSchema, receiptSchema } from "@/lib/costs/schema";

export type CostActionState = { error: string | null };

export async function saveMaterialCost(
  _state: CostActionState,
  form: FormData,
): Promise<CostActionState> {
  await requireCostAccess();
  const raw = Object.fromEntries(form);
  const cost = costSchema.safeParse(raw);
  if (!cost.success) return { error: cost.error.issues[0].message };
  const supabase = await createClient();
  let movementId: string;
  if (form.get("mode") === "purchase") {
    const receipt = receiptSchema.safeParse(raw);
    const requestId = z.uuid().safeParse(form.get("request_id"));
    if (!receipt.success) return { error: receipt.error.issues[0].message };
    if (!requestId.success)
      return { error: "Recarga la página para iniciar una nueva compra." };
    const { data, error } = await supabase.rpc(
      "create_costed_material_purchase",
      {
        p_request_id: requestId.data,
        p_receipt: receipt.data,
        p_cost: cost.data,
      },
    );
    if (error) return { error: error.message };
    movementId = data;
  } else {
    const target = z
      .object({
        movement_id: z.uuid(),
        expected_revision: z.coerce.number().int().nonnegative(),
      })
      .safeParse(raw);
    if (!target.success)
      return { error: "Entrada inválida. Recarga la página." };
    const { error } = await supabase.rpc("save_material_cost", {
      p_movement_id: target.data.movement_id,
      p_expected_revision: target.data.expected_revision,
      p_cost: cost.data,
    });
    if (error) return { error: error.message };
    movementId = target.data.movement_id;
  }
  revalidatePath("/inventario/costos", "layout");
  revalidatePath("/inventario/materia-prima");
  revalidatePath("/inventario/movimientos");
  revalidatePath("/inventario/registro");
  redirect(`/inventario/costos/${movementId}?guardado=1`);
}
