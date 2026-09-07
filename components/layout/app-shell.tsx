"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Boxes, ChevronLeft, ChevronRight, Factory, Gauge, LayoutDashboard, Menu, Settings, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/actions/auth";
import type { Database } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";
import { StockAlerts } from "@/components/inventario/stock-alerts";
import { BackButton } from "@/components/layout/back-button";
import { NavList, type NavItem } from "@/components/layout/nav-list";

type Role = Database["public"]["Enums"]["user_role"];

const SIDEBAR_COLLAPSED_KEY = "tecsopack:sidebar-collapsed";

const collapsedListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapsedListeners.add(listener);
  return () => collapsedListeners.delete(listener);
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

function getCollapsedServerSnapshot() {
  return false;
}

function setCollapsedStorage(value: boolean) {
  window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  collapsedListeners.forEach((listener) => listener());
}

const NAV_ITEMS: (NavItem & { roles: Role[] })[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard, roles: ["operario", "supervisor", "admin"] },
  { href: "/planta", label: "Planta", icon: Truck, roles: ["operario"] },
  {
    href: "/inventario",
    label: "Inventario",
    icon: Boxes,
    roles: ["supervisor", "admin"],
    children: [
      { href: "/inventario", label: "Materia prima" },
      { href: "/inventario/movimientos", label: "Movimientos MP" },
      { href: "/inventario-pt", label: "Producto terminado" },
      { href: "/inventario-pt/movimientos", label: "Movimientos PT" },
    ],
  },
  { href: "/maquinas", label: "Máquinas", icon: Factory, roles: ["supervisor", "admin"] },
  { href: "/oee", label: "OEE", icon: Gauge, roles: ["supervisor", "admin"] },
  { href: "/admin", label: "Administración", icon: Settings, roles: ["admin"] },
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
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      <StockAlerts />

      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-background transition-[width] duration-150 md:flex",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b border-border px-4 py-4",
            collapsed && "justify-center px-2",
          )}
        >
          <Link href="/" className="flex items-center gap-2 overflow-hidden">
            <Image
              src="/logo-icon.png"
              alt="Tecsopack"
              width={32}
              height={28}
              className="h-7 w-auto shrink-0"
              priority
            />
            {!collapsed && <span className="text-lg font-semibold">Tecsopack</span>}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavList items={items} pathname={pathname} collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => setCollapsedStorage(!collapsed)}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-1">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="md:hidden" />}>
                <Menu />
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 flex-col">
                <SheetHeader>
                  <SheetTitle>Tecsopack</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <NavList items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <BackButton />
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
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
