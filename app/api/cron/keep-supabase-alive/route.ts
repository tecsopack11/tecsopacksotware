import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json(
      { ok: false, error: "Supabase environment variables are not configured." },
      { status: 503 },
    );
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { error } = await supabase
    .from("machines")
    .select("id", { head: true })
    .limit(1);

  if (error) {
    console.error("Supabase keep-alive failed:", error.message);
    return Response.json({ ok: false, error: "Supabase query failed." }, { status: 502 });
  }

  return Response.json({ ok: true, checkedAt: new Date().toISOString() });
}
