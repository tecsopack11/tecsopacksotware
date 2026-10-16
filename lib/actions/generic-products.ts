"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import catalog from "@/lib/products/generic-catalog.json";

export type ImportState = { error: string | null; message: string | null };

export async function importarGenericos(): Promise<ImportState> {
  const session = await getProfile();
  if (!session?.profile.active || session.profile.role !== "admin") {
    return { error: "Solo un administrador activo puede cargar el catálogo.", message: null };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").upsert(
    catalog.map((item) => ({
      code: item.code,
      name: `${item.category} · ${item.reference} · ${item.design} · ${item.color} · ${item.dimensions} · CAL. ${item.gauge.toLocaleString("es-CO")}`,
      unit_of_measure: "unidad" as const,
      min_stock: 0,
      created_by: session.userId,
    })),
    { onConflict: "code", ignoreDuplicates: true },
  ).select("id");
  if (error) return { error: "No se pudo cargar el catálogo. Intenta nuevamente.", message: null };
  revalidatePath("/inventario-pt");
  revalidatePath("/inventario-pt/catalogo");
  revalidatePath("/admin/productos");
  revalidatePath("/inventario-pt/entradas/nueva");
  revalidatePath("/inventario-pt/salidas/nueva");
  return { error: null, message: `${data.length} variantes agregadas. Las existentes se conservaron. No se registraron existencias.` };
}
