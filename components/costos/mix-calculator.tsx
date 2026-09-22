"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCop } from "@/lib/costs/calculations";

type Material = {
  id: string;
  name: string;
  unit: string;
  cost: number | null;
  provisional: boolean;
};
export function MixCalculator({ materials }: { materials: Material[] }) {
  const [rows, setRows] = useState<{ material: string; percent: string }[]>([
    { material: "", percent: "" },
  ]);
  const [kg, setKg] = useState("100");
  const [product, setProduct] = useState("Lámina");
  const totalPercent = rows.reduce((sum, r) => sum + Number(r.percent || 0), 0);
  const ingredients = rows.map((r) => {
    const m = materials.find((m) => m.id === r.material);
    const factor =
      m?.unit === "kg"
        ? 1
        : m?.unit === "g"
          ? 1000
          : m?.unit === "ton"
            ? 0.001
            : null;
    return {
      m,
      percent: Number(r.percent),
      cost: factor !== null && m?.cost != null ? m.cost * factor : null,
    };
  });
  const valid =
    Math.abs(totalPercent - 100) < 0.00001 &&
    Number(kg) > 0 &&
    Number.isFinite(Number(kg)) &&
    new Set(rows.map((r) => r.material)).size === rows.length &&
    ingredients.every((i) => i.m && i.percent > 0 && i.cost !== null);
  const perKg = valid
    ? ingredients.reduce((sum, i) => sum + (i.percent / 100) * i.cost!, 0)
    : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimar materia prima de una mezcla</CardTitle>
        <p className="text-sm text-muted-foreground">
          Arma la mezcla de lámina o bolsa con tus porcentajes. Usa el promedio
          actual del inventario. Esta simulación no guarda una receta ni
          descuenta material; muestra únicamente el costo de MP.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-sm">
            Producto
            <select
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="h-10 rounded-md border bg-background px-3"
            >
              <option>Lámina</option>
              <option>Bolsa</option>
              <option>Otra mezcla</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Kilos de mezcla
            <Input
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              type="number"
              min="0.001"
              step="0.001"
            />
          </label>
        </div>
        {rows.map((r, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Material ${index + 1}`}
              value={r.material}
              onChange={(e) =>
                setRows((old) =>
                  old.map((r, i) =>
                    i === index ? { ...r, material: e.target.value } : r,
                  ),
                )
              }
              className="h-10 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Selecciona ingrediente</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
            <Input
              aria-label={`Porcentaje del ingrediente ${index + 1}`}
              type="number"
              min="0.001"
              max="100"
              step="0.001"
              placeholder="%"
              className="w-24"
              value={r.percent}
              onChange={(e) =>
                setRows((old) =>
                  old.map((r, i) =>
                    i === index ? { ...r, percent: e.target.value } : r,
                  ),
                )
              }
            />
            <span>%</span>
            <Button
              type="button"
              variant="ghost"
              disabled={rows.length === 1}
              onClick={() =>
                setRows((old) => old.filter((_, i) => i !== index))
              }
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((r) => [...r, { material: "", percent: "" }])}
        >
          Agregar ingrediente
        </Button>
        <p className="text-sm">
          Total: {totalPercent.toFixed(2)}% · MP por kg:{" "}
          <strong>{formatCop(perKg)}</strong> · MP para {kg || "0"} kg de{" "}
          {product.toLowerCase()}:{" "}
          <strong>
            {formatCop(perKg === null ? null : perKg * Number(kg))}
          </strong>
        </p>
        {!valid && (
          <p className="text-xs text-muted-foreground">
            Completa 100% con ingredientes distintos y costos disponibles. Para
            calcular por kg, los materiales deben estar registrados en kg, g o
            ton; bultos y cuñetes requieren una equivalencia de peso.
          </p>
        )}
        {valid && ingredients.some((i) => i.m?.provisional) && (
          <p className="text-xs text-muted-foreground">
            Estimación provisional: hay costos de ingredientes pendientes de
            confirmar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
