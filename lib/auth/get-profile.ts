import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getProfile(): Promise<{
  userId: string;
  email: string | undefined;
  profile: Profile;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.sub)
    .single();

  if (!profile) return null;

  return { userId: user.sub, email: user.email, profile };
}
