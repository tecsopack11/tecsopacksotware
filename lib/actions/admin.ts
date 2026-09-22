"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

const deleteCatalogItemSchema = z.object({
  id: z.string().uuid(),
});

async function requireSuperAdmin() {
  const session = await getProfile();
  if (
    !session?.profile.active ||
    session.profile.role !== "admin" ||
    !session.profile.is_super_admin
  ) {
    return null;
  }
  return session;
}

export async function eliminarMaterial(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteCatalogItemSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Material no válido." };
  if (!(await requireSuperAdmin())) {
    return { error: "Solo un Super Admin puede eliminar materiales." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("materials").delete().eq("id", parsed.data.id);
  if (error?.code === "23503") {
    return {
      error: "No se puede eliminar porque el material tiene movimientos o registros asociados.",
    };
  }
  if (error) return { error: "No se pudo eliminar el material." };

  revalidatePath("/admin/materiales");
  revalidatePath("/inventario");
  revalidatePath("/inventario/materia-prima");
  revalidatePath("/inventario/costos");
  return { error: null };
}

export async function eliminarProducto(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deleteCatalogItemSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Producto no válido." };
  if (!(await requireSuperAdmin())) {
    return { error: "Solo un Super Admin puede eliminar productos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", parsed.data.id);
  if (error?.code === "23503") {
    return {
      error: "No se puede eliminar porque el producto tiene movimientos asociados.",
    };
  }
  if (error) return { error: "No se pudo eliminar el producto." };

  revalidatePath("/admin/productos");
  revalidatePath("/inventario-pt");
  return { error: null };
}

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

const productSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit_of_measure: z.enum(["kg", "g", "ton", "bulto", "unidad", "cuñete"]),
  min_stock: z.coerce.number().min(0),
});

export async function crearProducto(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión no válida." };

  const { error } = await supabase
    .from("products")
    .insert({ ...parsed.data, created_by: user.id });
  if (error) return { error: error.message };

  revalidatePath("/admin/productos");
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

const superAdminSchema = z.object({
  profile_id: z.string().uuid(),
  is_super_admin: z.enum(["true", "false"]),
});

export async function actualizarSuperAdmin(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = superAdminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Datos inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_super_admin: parsed.data.is_super_admin === "true" })
    .eq("id", parsed.data.profile_id);
  if (error) return { error: error.message };

  revalidatePath("/admin/usuarios");
  return { error: null };
}
