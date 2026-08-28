import { redirect } from "next/navigation";
import Link from "next/link";
import { getProfile } from "@/lib/auth/get-profile";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/materiales", label: "Materiales" },
  { href: "/admin/maquinas", label: "Máquinas" },
  { href: "/admin/ubicaciones", label: "Ubicaciones" },
  { href: "/admin/motivos-paro", label: "Motivos de paro" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getProfile();
  if (!session || session.profile.role !== "admin") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Administración</h1>
        <nav className="mt-3 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
