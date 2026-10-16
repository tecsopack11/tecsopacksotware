"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCostAccess } from "@/lib/costs/data";
import { costSchema, receiptSchema } from "@/lib/costs/schema";

export type CostActionState = { error: string | null };

const quickPurchaseSchema = z.object({
  request_id: z.uuid(),
  material_id: z.uuid(),
  to_location_id: z.uuid(),
  quantity: z.coerce.number().finite().positive().max(999_999_999),
  unit_price: z.coerce.number().finite().positive().max(999_999_999),
  purchase_date: z.iso.date(),
  supplier: z.string().trim().max(200),
  invoice: z.string().trim().max(200),
});

export async function saveQuickMaterialPurchase(
  _state: CostActionState,
  form: FormData,
): Promise<CostActionState> {
  await requireCostAccess();
  const parsed = quickPurchaseSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (parsed.data.purchase_date > today) {
    return { error: "La fecha no puede estar en el futuro." };
  }

  const supabase = await createClient();
  const shortId = parsed.data.request_id.slice(0, 8).toUpperCase();
  const { error } = await supabase.rpc("create_costed_material_purchase", {
    p_request_id: parsed.data.request_id,
    p_receipt: {
      material_id: parsed.data.material_id,
      to_location_id: parsed.data.to_location_id,
      quantity: parsed.data.quantity,
      lot_code: `RAP-${parsed.data.purchase_date.replaceAll("-", "")}-${shortId}`,
    },
    p_cost: {
      purchase_date: parsed.data.purchase_date,
      supplier: parsed.data.supplier || "Sin informar",
      invoice: parsed.data.invoice || `Registro rápido ${shortId}`,
      shipment: "",
      currency: "COP",
      exchange_rate: 1,
      unit_price: parsed.data.unit_price,
      discount: 0,
      freight: 0,
      insurance: 0,
      duties: 0,
      other_costs: 0,
      recoverable_tax: 0,
      allocation_note: "",
      status: "confirmed",
      reason: "Registro rápido de compra y precio",
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/inventario/costos", "layout");
  revalidatePath("/inventario/materia-prima");
  revalidatePath("/inventario/movimientos");
  redirect("/inventario/costos?guardado=1");
}

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
