"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string }[];
};

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function NavList({
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [openHref, setOpenHref] = useState<string | null>(null);

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const hasChildren = !!item.children?.length;
        const open = !collapsed && hasChildren && (openHref === item.href || active);

        return (
          <div key={item.href}>
            <div
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <Link
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex flex-1 items-center gap-3 px-3 py-2",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
              {hasChildren && !collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenHref(open ? null : item.href)}
                  className="px-2 py-2 text-muted-foreground hover:text-foreground"
                  aria-label={open ? "Contraer" : "Expandir"}
                >
                  <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
                </button>
              )}
            </div>
            {hasChildren && open && (
              <div className="mt-1 ml-6 flex flex-col gap-1 border-l border-border pl-3">
                {item.children!.map((child) => {
                  const childActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm transition-colors",
                        childActive
                          ? "bg-secondary text-secondary-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
