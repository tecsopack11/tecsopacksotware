"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

const dailyRowSchema = z.object({
  material_id: z.string().uuid(),
  entry: z.number().nonnegative(),
  exit: z.number().nonnegative(),
});

const dailyRegisterSchema = z.object({
  location_id: z.string().uuid(),
  movement_kind: z.enum(["regular", "sale"]),
  record_date: z.iso.date(),
  responsible: z.string().trim().min(1, "El responsable es obligatorio"),
  observations: z.string().trim().max(500).optional(),
  rows: z.array(dailyRowSchema).min(1, "Digita al menos una entrada o salida"),
});

export async function crearRegistroDiario(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rows: z.infer<typeof dailyRowSchema>[] = [];

  for (const [key, value] of formData.entries()) {
    const match = /^(entry|exit)\.([0-9a-f-]{36})$/.exec(key);
    if (!match || typeof value !== "string" || value.trim() === "") continue;

    const quantity = Number(value);
    if (!Number.isFinite(quantity) || quantity < 0) {
      return { error: "Todas las cantidades deben ser números positivos." };
    }

    const [, field, materialId] = match;
    let row = rows.find((item) => item.material_id === materialId);
    if (!row) {
      row = { material_id: materialId, entry: 0, exit: 0 };
      rows.push(row);
    }
    row[field as "entry" | "exit"] = quantity;
  }

  const parsed = dailyRegisterSchema.safeParse({
    location_id: formData.get("location_id"),
    movement_kind: formData.get("movement_kind"),
    record_date: formData.get("record_date"),
    responsible: formData.get("responsible"),
    observations: formData.get("observations"),
    rows: rows.filter((row) => row.entry > 0 || row.exit > 0),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  if (parsed.data.movement_kind === "sale" && parsed.data.rows.some((row) => row.entry > 0)) {
    return { error: "Una venta de materia prima solo puede registrar salidas." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase.rpc("create_daily_inventory_register", {
    p_location_id: parsed.data.location_id,
    p_record_date: parsed.data.record_date,
    p_responsible: parsed.data.responsible,
    p_observations: parsed.data.movement_kind === "sale"
      ? `[VENTA_MP]${parsed.data.observations ?? ""}`
      : parsed.data.observations ?? "",
    p_rows: parsed.data.rows,
  });

  if (error) return { error: error.message };

  revalidatePath("/inventario/materia-prima");
  revalidatePath("/inventario/movimientos");
  redirect("/inventario/materia-prima");
}

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

  revalidatePath("/inventario/materia-prima");
  redirect("/inventario/materia-prima");
}

const salidaSchema = z.object({
  movement_type: z.enum(["salida", "traslado", "consumo"]),
  material_id: z.string().uuid(),
  lot_id: z.string().uuid().optional().or(z.literal("")),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  from_location_id: z.string().uuid(),
  to_location_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().optional(),
  redirect_to: z.enum(["/inventario/materia-prima", "/planta"]).optional(),
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

  const destination = input.redirect_to ?? "/inventario/materia-prima";
  revalidatePath("/inventario/materia-prima");
  revalidatePath("/planta");
  redirect(destination);
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

const confirmReceiptSchema = z.object({
  movement_id: z.string().uuid(),
});

export async function confirmarRecepcion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = confirmReceiptSchema.safeParse(Object.fromEntries(formData));
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
      received_by: user.id,
      received_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.movement_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/inventario/movimientos");
  revalidatePath("/inventario/materia-prima");
  revalidatePath("/planta");
  return { error: null };
}
