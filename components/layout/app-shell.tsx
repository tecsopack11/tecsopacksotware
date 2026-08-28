"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import type { Database } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { StockAlerts } from "@/components/inventario/stock-alerts";

type Role = Database["public"]["Enums"]["user_role"];

const NAV_ITEMS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Panel", roles: ["operario", "supervisor", "admin"] },
  { href: "/inventario", label: "Inventario", roles: ["operario", "supervisor", "admin"] },
  { href: "/maquinas", label: "Máquinas", roles: ["operario", "supervisor", "admin"] },
  { href: "/oee", label: "OEE", roles: ["operario", "supervisor", "admin"] },
  { href: "/admin", label: "Administración", roles: ["admin"] },
];

const ROLE_LABEL: Record<Role, string> = {
  operario: "Operario",
  supervisor: "Supervisor",
  admin: "Administrador",
};

export function AppShell({
  fullName,
  role,
  isSuperAdmin,
  children,
}: {
  fullName: string;
  role: Role;
  isSuperAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <div className="flex min-h-svh flex-col">
      <StockAlerts />
      <header className="border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo-icon.png" alt="Tecsopack" width={32} height={28} className="h-7 w-auto" priority />
              <span className="text-lg font-semibold">Tecsopack</span>
            </Link>
            <nav className="flex flex-wrap gap-1">
              {items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-secondary text-secondary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="font-medium">{fullName || "Usuario"}</div>
              <div className="flex items-center justify-end gap-1">
                <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
                {isSuperAdmin && <Badge>Super Admin</Badge>}
              </div>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
