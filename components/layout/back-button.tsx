"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/") return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => router.back()}
      aria-label="Volver"
    >
      <ArrowLeft />
    </Button>
  );
}
