"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

const entradaSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  to_location_id: z.string().uuid(),
  reference_doc: z.string().optional(),
  notes: z.string().optional(),
});

export async function crearProductoEntrada(
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

  const { error } = await supabase.from("product_movements").insert({
    movement_type: "entrada",
    product_id: input.product_id,
    quantity: input.quantity,
    to_location_id: input.to_location_id,
    reference_doc: input.reference_doc || null,
    notes: input.notes || null,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventario-pt");
  redirect("/inventario-pt");
}

const salidaSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  from_location_id: z.string().uuid(),
  reference_doc: z.string().optional(),
  notes: z.string().optional(),
});

export async function crearProductoSalida(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = salidaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_product_outbound_movement", {
    p_product_id: input.product_id,
    p_quantity: input.quantity,
    p_from_location_id: input.from_location_id,
    p_reference_doc: input.reference_doc || undefined,
    p_notes: input.notes || undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventario-pt");
  redirect("/inventario-pt");
}

const cancelSchema = z.object({
  movement_id: z.string().uuid(),
  cancel_reason: z.string().min(1, "El motivo es obligatorio"),
});

export async function cancelarMovimientoProducto(
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
    .from("product_movements")
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      cancel_reason: parsed.data.cancel_reason,
    })
    .eq("id", parsed.data.movement_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventario-pt/movimientos");
  return { error: null };
}
