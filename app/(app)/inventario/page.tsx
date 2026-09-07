import Link from "next/link";
import { Warehouse, Factory, ShoppingCart, PackageCheck, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HubBox = {
  href: string | null;
  icon: LucideIcon;
  title: string;
  description: string;
};

const BOXES: HubBox[] = [
  {
    href: "/inventario/materia-prima?area=bodega",
    icon: Warehouse,
    title: "Bodega",
    description: "Materia prima disponible para producir o comprar.",
  },
  {
    href: "/inventario/materia-prima?area=proceso",
    icon: Factory,
    title: "Producción",
    description: "Materia prima ya enviada a piso de fábrica y máquinas.",
  },
  {
    href: null,
    icon: ShoppingCart,
    title: "Vendedor",
    description: "Pedidos de venta y verificación de stock disponible.",
  },
  {
    href: "/inventario-pt",
    icon: PackageCheck,
    title: "PT",
    description: "Inventario de producto terminado.",
  },
];

function HubCard({ box }: { box: HubBox }) {
  const Icon = box.icon;
  const content = (
    <Card
      className={cn(
        "h-full transition-colors",
        box.href ? "hover:border-primary/50 hover:bg-muted/40" : "opacity-60",
      )}
    >
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <Icon className="size-6 text-muted-foreground" />
        <CardTitle className="flex items-center gap-2 text-lg">
          {box.title}
          {!box.href && (
            <Badge variant="outline" className="font-normal">
              Próximamente
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{box.description}</p>
      </CardContent>
    </Card>
  );

  if (!box.href) {
    return <div>{content}</div>;
  }

  return (
    <Link href={box.href} className="block h-full">
      {content}
    </Link>
  );
}

export default function InventarioHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <p className="text-muted-foreground">Elige qué área quieres revisar.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {BOXES.map((box) => (
          <HubCard key={box.title} box={box} />
        ))}
      </div>
    </div>
  );
}
