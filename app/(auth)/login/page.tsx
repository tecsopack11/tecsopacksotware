import { AuthCard } from "@/components/auth/auth-card";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <AuthCard />
    </div>
  );
}
