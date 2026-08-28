"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

const materialSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  material_type: z.enum(["resina", "masterbatch", "aditivo", "otro"]),
  unit_of_measure: z.enum(["kg", "g", "ton", "bulto", "unidad", "cuñete"]),
  min_stock: z.coerce.number().min(0),
  category: z.enum(["principal", "pigmento", "tinta", "solvente"]),
});

export async function crearMaterial(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = materialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase
    .from("materials")
    .insert({ ...parsed.data, created_by: user.id });
  if (error) return { error: error.message };

  revalidatePath("/admin/materiales");
  return { error: null };
}

const machineSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  machine_type: z.string().optional(),
  ideal_run_rate_per_hour: z.coerce.number().positive().optional().or(z.nan()),
});

export async function crearMaquina(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = machineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const rate = Number.isNaN(parsed.data.ideal_run_rate_per_hour)
    ? null
    : parsed.data.ideal_run_rate_per_hour;

  const { error } = await supabase.from("machines").insert({
    code: parsed.data.code,
    name: parsed.data.name,
    machine_type: parsed.data.machine_type || null,
    ideal_run_rate_per_hour: rate,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/maquinas");
  revalidatePath("/maquinas");
  return { error: null };
}

const locationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["bodega", "piso", "externo", "merma"]),
});

export async function crearUbicacion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = locationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/admin/ubicaciones");
  return { error: null };
}

const downtimeReasonSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["planeado", "no_planeado"]),
});

export async function crearMotivoParo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = downtimeReasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.from("downtime_reasons").insert(parsed.data);
  if (error) return { error: error.message };

  revalidatePath("/admin/motivos-paro");
  return { error: null };
}

const roleSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(["operario", "supervisor", "admin"]),
});

export async function actualizarRol(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.profile_id);
  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}
