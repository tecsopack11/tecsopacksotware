"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

const entradaSchema = z.object({
  material_id: z.string().uuid(),
  lot_code: z.string().min(1, "El lote es obligatorio"),
  supplier: z.string().optional(),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  to_location_id: z.string().uuid(),
  reference_doc: z.string().optional(),
  notes: z.string().optional(),
});

export async function crearEntrada(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = entradaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  // Encuentra o crea el lote para este material.
  let lotId: string;
  const { data: existingLot } = await supabase
    .from("material_lots")
    .select("id")
    .eq("material_id", input.material_id)
    .eq("lot_code", input.lot_code)
    .maybeSingle();

  if (existingLot) {
    lotId = existingLot.id;
  } else {
    const { data: newLot, error: lotError } = await supabase
      .from("material_lots")
      .insert({
        material_id: input.material_id,
        lot_code: input.lot_code,
        supplier: input.supplier || null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (lotError || !newLot) {
      return { error: `No se pudo crear el lote: ${lotError?.message ?? ""}` };
    }
    lotId = newLot.id;
  }

  const { error: movementError } = await supabase.from("inventory_movements").insert({
    movement_type: "entrada",
    material_id: input.material_id,
    lot_id: lotId,
    quantity: input.quantity,
    to_location_id: input.to_location_id,
    reference_doc: input.reference_doc || null,
    notes: input.notes || null,
    created_by: user.id,
  });

  if (movementError) {
    return { error: movementError.message };
  }

  revalidatePath("/inventario");
  redirect("/inventario");
}

const salidaSchema = z.object({
  movement_type: z.enum(["salida", "traslado", "consumo"]),
  material_id: z.string().uuid(),
  lot_id: z.string().uuid().optional().or(z.literal("")),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  from_location_id: z.string().uuid(),
  to_location_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function crearSalidaTraslado(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = salidaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;

  if (input.movement_type === "traslado" && !input.to_location_id) {
    return { error: "El traslado requiere una ubicación destino." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_outbound_movement", {
    p_movement_type: input.movement_type,
    p_material_id: input.material_id,
    p_lot_id: input.lot_id || undefined,
    p_quantity: input.quantity,
    p_from_location_id: input.from_location_id,
    p_to_location_id: input.to_location_id || undefined,
    p_notes: input.notes || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventario");
  redirect("/inventario");
}

const cancelSchema = z.object({
  movement_id: z.string().uuid(),
  cancel_reason: z.string().min(1, "El motivo es obligatorio"),
});

export async function cancelarMovimiento(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase
    .from("inventory_movements")
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancel_reason: parsed.data.cancel_reason,
    })
    .eq("id", parsed.data.movement_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventario/movimientos");
  return { error: null };
}
