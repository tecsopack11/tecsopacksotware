"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function combineDateAndTime(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

const abrirTurnoSchema = z.object({
  machine_id: z.string().uuid(),
  shift_id: z.string().uuid(),
});

export async function abrirTurno(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = abrirTurnoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { data: shift, error: shiftError } = await supabase
    .from("shift_catalog")
    .select("start_time, end_time")
    .eq("id", parsed.data.shift_id)
    .single();
  if (shiftError || !shift) return { error: "Turno no encontrado." };

  const today = new Date().toISOString().slice(0, 10);
  const plannedStart = combineDateAndTime(today, shift.start_time);
  const plannedEnd = combineDateAndTime(today, shift.end_time);

  const { error } = await supabase.from("shift_instances").insert({
    machine_id: parsed.data.machine_id,
    shift_id: parsed.data.shift_id,
    operator_id: user.id,
    planned_start: plannedStart,
    planned_end: plannedEnd,
    actual_start: new Date().toISOString(),
    status: "abierto",
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/maquinas");
  return { error: null };
}

const idSchema = z.object({ shift_instance_id: z.string().uuid(), machine_id: z.string().uuid() });

export async function cerrarTurno(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  // Cierra cualquier paro abierto de la máquina para no dejarlo huérfano.
  await supabase
    .from("machine_downtime_events")
    .update({ end_time: new Date().toISOString(), closed_by: user.id })
    .eq("machine_id", parsed.data.machine_id)
    .is("end_time", null);

  const { error } = await supabase
    .from("shift_instances")
    .update({ status: "cerrado", actual_end: new Date().toISOString() })
    .eq("id", parsed.data.shift_instance_id);

  if (error) return { error: error.message };

  revalidatePath("/maquinas");
  return { error: null };
}

const iniciarParoSchema = z.object({
  shift_instance_id: z.string().uuid(),
  machine_id: z.string().uuid(),
  reason_id: z.string().uuid(),
  notes: z.string().optional(),
});

export async function iniciarParo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = iniciarParoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Selecciona un motivo de paro." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase.from("machine_downtime_events").insert({
    shift_instance_id: parsed.data.shift_instance_id,
    machine_id: parsed.data.machine_id,
    reason_id: parsed.data.reason_id,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/maquinas");
  return { error: null };
}

const cerrarParoSchema = z.object({ downtime_id: z.string().uuid() });

export async function cerrarParo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cerrarParoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase
    .from("machine_downtime_events")
    .update({ end_time: new Date().toISOString(), closed_by: user.id })
    .eq("id", parsed.data.downtime_id);

  if (error) return { error: error.message };

  revalidatePath("/maquinas");
  return { error: null };
}

const produccionSchema = z.object({
  shift_instance_id: z.string().uuid(),
  machine_id: z.string().uuid(),
  good_qty: z.coerce.number().int().min(0),
  reject_qty: z.coerce.number().int().min(0),
  reject_reason: z.string().optional(),
});

export async function registrarProduccion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = produccionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase.from("production_counts").insert({
    shift_instance_id: parsed.data.shift_instance_id,
    machine_id: parsed.data.machine_id,
    good_qty: parsed.data.good_qty,
    reject_qty: parsed.data.reject_qty,
    reject_reason: parsed.data.reject_reason || null,
    created_by: user.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/maquinas");
  revalidatePath("/oee");
  return { error: null };
}
