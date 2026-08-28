import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/get-profile";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getProfile();

  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell fullName={session.profile.full_name} role={session.profile.role}>
      {children}
    </AppShell>
  );
}
