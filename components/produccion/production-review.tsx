"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ClipboardList, Factory, PackageCheck, Truck } from "lucide-react";
import catalog from "@/lib/products/generic-catalog.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCanonicalNumber } from "@/lib/numbers";

const kg = (value: number) => `${value.toLocaleString("es-CO", { maximumFractionDigits: 3 })} kg`;
const selectStyle = "h-9 w-full rounded-md border bg-background px-3 text-sm";
type Draft = { number: string; purpose: string; client: string; reference: string; quantity: string; unit: string; targetKg: string; delivery: string; purchaseOrder: string };
type Transfer = { id: number; quantity: number; received: number; sender: string; receiver: string; time: string };

export function ProductionReview() {
  const [tab, setTab] = useState<"order" | "transfer">("order");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [purpose, setPurpose] = useState("generic");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [amount, setAmount] = useState("40");
  const [responsible, setResponsible] = useState("");
  const [receiver, setReceiver] = useState("");
  const [error, setError] = useState("");
  const sent = transfers.reduce((sum, transfer) => sum + transfer.quantity, 0);
  const received = transfers.reduce((sum, transfer) => sum + transfer.received, 0);
  const available = Math.round((100 - sent) * 1000) / 1000;
  const transit = Math.round((sent - received) * 1000) / 1000;

  function reviewOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setDraft(Object.fromEntries(["number", "purpose", "client", "reference", "quantity", "unit", "targetKg", "delivery", "purchaseOrder"].map((key) => [key, String(data.get(key) ?? "")])) as Draft);
  }

  function sendTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > available || !responsible.trim()) {
      setError("Indica un responsable y una cantidad mayor que cero, sin superar el saldo de origen.");
      return;
    }
    setTransfers((current) => [...current, { id: current.length + 1, quantity: value, received: 0, sender: responsible.trim(), receiver: "", time: new Date().toLocaleTimeString("es-CO") }]);
    setError("");
  }

  return <div className="mx-auto max-w-6xl space-y-6 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold tracking-widest text-primary">CONTROL DE PLANTA</p><h1 className="mt-1 text-2xl font-semibold">PRODUCCIÓN Y TRAZABILIDAD</h1><p className="mt-2 text-sm text-muted-foreground">Una orden, sus kilos y cada traslado hasta producto terminado.</p></div>
      <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">VISTA PARA REVISIÓN</span>
    </div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <strong>Prueba de flujo.</strong> Los formularios funcionan en esta pantalla y se borran al recargar. No crean órdenes, no mueven inventario ni asignan permisos reales. Las rutas y máquinas se configurarán con planta.
    </div>

    <section aria-labelledby="flow-heading" className="rounded-xl border bg-card p-5">
      <h2 id="flow-heading" className="font-semibold">EL RECORRIDO QUE VAMOS A CONTROLAR</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          { icon: Factory, title: "1. ENTREGA DE MP", text: "Bodega entrega a extrusión; impresión recibe tintas. La salida descuenta una sola vez la bodega de origen." },
          { icon: ClipboardList, title: "2. TRANSFORMACIÓN", text: "La orden registra consumo, kilos útiles, desperdicio, recuperable y MP sobrante por separado." },
          { icon: Truck, title: "3. TRASLADOS INTERNOS", text: "Las demás etapas reciben producto en proceso. Cada envío conserva orden, lote, kilos y responsables." },
          { icon: PackageCheck, title: "4. PRODUCTO TERMINADO", text: "Se recibe por orden y lote, con unidades y kilos reales. Fabricar y despachar son eventos distintos." },
        ].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-lg bg-muted/50 p-4"><Icon className="mb-3 size-5 text-primary" /><h3 className="text-xs font-semibold">{title}</h3><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>)}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Entregar MP a una máquina y consumirla son registros diferentes. Un traslado de producto en proceso conserva sus kilos y costo; no vuelve a descontar MP.</p>
    </section>

    <div className="flex flex-wrap gap-2" aria-label="Seleccionar formulario de revisión">
      <Button variant={tab === "order" ? "default" : "outline"} onClick={() => setTab("order")}>1. REVISAR ORDEN DE PRODUCCIÓN</Button>
      <Button variant={tab === "transfer" ? "default" : "outline"} onClick={() => setTab("transfer")}>2. PROBAR TRASLADO DE KILOS</Button>
    </div>

    {tab === "order" ? <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">DATOS DE LA ORDEN</h2><p className="mt-1 text-sm text-muted-foreground">Revisa los campos con una orden real. El catálogo conserva cada variante del Excel; las cantidades empiezan vacías.</p>
      <form onSubmit={reviewOrder} className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm">NÚMERO DE OP<Input name="number" required placeholder="Número de la orden" /></label>
        <label className="space-y-1 text-sm">DESTINO DE PRODUCCIÓN<select name="purpose" value={purpose} onChange={(event) => setPurpose(event.target.value)} className={selectStyle}><option value="generic">REPOSICIÓN DE GENÉRICO</option><option value="client">PEDIDO DE CLIENTE</option></select></label>
        <label className="space-y-1 text-sm">CLIENTE {purpose === "generic" && "(OPCIONAL)"}<Input name="client" required={purpose === "client"} placeholder="Nombre del cliente" /></label>
        <label className="space-y-1 text-sm md:col-span-2 lg:col-span-3">REFERENCIA Y VARIANTE<select name="reference" required defaultValue="" className={selectStyle}><option value="" disabled>SELECCIONAR DEL EXCEL</option>{catalog.map((item) => <option key={item.code} value={`${item.reference} · ${item.design} · ${item.color} · ${item.dimensions} · CAL. ${formatCanonicalNumber(item.gauge)} (${item.code})`}>{item.reference} · {item.design} · {item.color} · {item.dimensions} · CAL. {formatCanonicalNumber(item.gauge)}</option>)}</select></label>
        <label className="space-y-1 text-sm">CANTIDAD SOLICITADA<Input name="quantity" type="number" min="0.001" step="0.001" required placeholder="Por definir" /></label>
        <label className="space-y-1 text-sm">UNIDAD SOLICITADA<select name="unit" className={selectStyle}><option>UNIDADES</option><option>PAQUETES</option><option>BULTOS</option><option>KG</option></select></label>
        <label className="space-y-1 text-sm">KG OBJETIVO (SI SE CONOCEN)<Input name="targetKg" type="number" min="0.001" step="0.001" placeholder="Pendiente de planta" /></label>
        <label className="space-y-1 text-sm">FECHA DE ENTREGA<Input name="delivery" type="date" required /></label>
        <label className="space-y-1 text-sm">ORDEN DE COMPRA (SI APLICA)<Input name="purchaseOrder" placeholder="OC del cliente" /></label>
        <div className="flex items-end"><Button type="submit">REVISAR BORRADOR LOCAL <ArrowRight /></Button></div>
      </form>
      {draft && <div role="status" className="mt-5 rounded-lg border bg-muted/40 p-4 text-sm"><strong>BORRADOR LOCAL · OP {draft.number}</strong><p className="mt-2">{draft.purpose === "generic" ? "Reposición de genérico" : `Cliente: ${draft.client}`} · {formatCanonicalNumber(draft.quantity)} {draft.unit.toLowerCase()} · entrega {draft.delivery}</p><p className="mt-1 break-words">{draft.reference}</p><p className="mt-1">Kg objetivo: {draft.targetKg ? formatCanonicalNumber(draft.targetKg) : "por definir"} · OC: {draft.purchaseOrder || "no indicada"}</p><p className="mt-2 text-muted-foreground">Pendiente asignar receta, ruta, máquinas y responsables. Este borrador no reserva MP ni crea existencias.</p></div>}
    </section> : <section className="space-y-5 rounded-xl border bg-card p-5">
      <div><h2 className="font-semibold">SIMULACIÓN · OP DEMO / LOTE DEMO</h2><p className="mt-1 text-sm text-muted-foreground">Ejemplo ficticio: 100 kg útiles ya producidos en extrusión. Las ubicaciones siguientes se confirmarán con planta. El desperdicio se registra en transformación y no se oculta como traslado.</p></div>
      <div className="grid gap-3 sm:grid-cols-3">{[["ORIGEN · EXTRUSIÓN", available], ["EN TRÁNSITO", transit], ["DESTINO · ETAPA POR CONFIRMAR", received]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{kg(Number(value))}</p></div>)}</div>
      <p className="text-sm text-muted-foreground">Balance del ejemplo: origen + tránsito + destino = 100 kg. Enviar descuenta origen; recibir reduce tránsito y suma destino.</p>
      <form onSubmit={sendTransfer} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">KG A ENVIAR<Input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min="0.001" max={available} step="0.001" required /></label>
        <label className="space-y-1 text-sm">RESPONSABLE DEL ENVÍO<Input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Nombre para la prueba" required /></label>
        <Button type="submit" disabled={available === 0}>SIMULAR ENVÍO PARCIAL</Button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <label className="block max-w-sm space-y-1 text-sm">RESPONSABLE DE RECIBIR<Input value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="Nombre para confirmar la recepción" /></label>
      <div className="space-y-2" aria-live="polite">{transfers.length === 0 && <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Envía 40 kg para ver 60 kg en origen y 40 kg en tránsito. Después confirma la recepción.</p>}{transfers.map((transfer) => <div key={transfer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div className="text-sm"><strong>ENVÍO DEMO {transfer.id} · {kg(transfer.quantity)}</strong><p className="mt-1 text-muted-foreground">{transfer.time} · envía {transfer.sender} · {transfer.received ? `recibido por ${transfer.receiver}` : "pendiente de recepción"}</p></div><Button variant="outline" disabled={transfer.received > 0 || !receiver.trim()} onClick={() => setTransfers((current) => current.map((item) => item.id === transfer.id && item.received === 0 ? { ...item, received: item.quantity, receiver: receiver.trim() } : item))}>{transfer.received ? "RECIBIDO" : "SIMULAR RECEPCIÓN"}</Button></div>)}</div>
      <Button variant="ghost" onClick={() => { setTransfers([]); setError(""); setAmount("40"); setResponsible(""); setReceiver(""); }}>REINICIAR EJEMPLO</Button>
    </section>}

    <section className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border p-5"><h2 className="font-semibold">QUIÉN HACE QUÉ</h2><p className="mt-3 text-sm"><strong>SUPER ADMIN:</strong> consulta saldos por orden, lote y ubicación; revisa responsables, desperdicio e historial.</p><p className="mt-3 text-sm"><strong>OPERARIO:</strong> registra avances y traslados de su área hasta completar la orden.</p><p className="mt-3 text-sm text-muted-foreground">Los permisos por área y las validaciones en base de datos se implementarán al confirmar el flujo.</p></div>
      <div className="rounded-xl border p-5"><h2 className="font-semibold">LO QUE NECESITAMOS DE PLANTA</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>Procesos, máquinas, rutas y excepciones por producto.</li><li>Recetas, desperdicio, recuperado y una OP real.</li><li>Quién envía, quién recibe y cómo resuelven diferencias de peso.</li><li>Lotes, saldos iniciales y tratamiento de solventes.</li></ul></div>
    </section>
  </div>;
}
