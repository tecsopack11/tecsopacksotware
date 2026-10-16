import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const changes = [
  { title: "1. MATERIA PRIMA", href: "/inventario/materia-prima", owner: "AGENTE DE MATERIA PRIMA", description: "Revisa nombres, orden, VERDE CLARO y VERDE OSCURO, separadores de miles y filtros de búsqueda.", note: "Los nombres son de presentación; se conservan códigos e historial." },
  { title: "2. COSTOS", href: "/inventario/costos?ano=2026", owner: "AGENTE DE COSTOS", description: "Revisa captura de cantidad y precio, promedio ponderado anual e historial por año y material.", note: "Las entradas sin precio siguen pendientes. El promedio anual y la valoración móvil se muestran por separado." },
  { title: "3. PRODUCCIÓN Y TRASLADOS", href: "/produccion", owner: "AGENTE DE PRODUCCIÓN", description: "Revisa los campos de la orden y prueba un traslado parcial de kilos, su tránsito y su recepción.", note: "Es una simulación local que se borra al recargar. No crea órdenes ni modifica inventario." },
  { title: "4. PRODUCTO TERMINADO", href: "/inventario-pt/catalogo", owner: "INTEGRACIÓN PRINCIPAL", description: "Revisa las 63 variantes del Excel y las existencias por diligenciar. Paquete y bulto son presentaciones.", note: "No se han cargado cantidades. La creación de referencias en la base está pendiente de permisos y aceptación." },
];

export default function ChangeReviewPage() {
  return <div className="mx-auto max-w-5xl space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">REVISIÓN DE CAMBIOS</h1>
      <p className="mt-2 text-muted-foreground">Revisa cada módulo y comparte los ajustes o tu aceptación. El commit y el push quedan pendientes de tu aprobación.</p>
    </div>
    <p className="rounded-lg border bg-muted/40 p-4 text-sm">Las pantallas de inventario y costos consultan la base configurada. Guardar una compra, entrada o carga de catálogo modifica esa base; para revisar el diseño y los datos puedes navegar y filtrar sin guardar. La simulación de producción sí permite probar los botones sin modificar datos.</p>
    <div className="grid gap-4 md:grid-cols-2">
      {changes.map((change) => <Card key={change.href}>
        <CardHeader><p className="text-xs text-muted-foreground">{change.owner}</p><CardTitle>{change.title}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>{change.description}</p><p className="text-sm text-muted-foreground">{change.note}</p>
          <Button render={<Link href={change.href} />} nativeButton={false}>ABRIR CAMBIOS</Button>
        </CardContent>
      </Card>)}
    </div>
  </div>;
}
