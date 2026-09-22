"use client";
import { Button } from "@/components/ui/button";

export function CostExport({
  month,
  rows,
}: {
  month: string;
  rows: (string | number | null)[][];
}) {
  function download() {
    const encode = (value: string | number | null) => {
      let text = value === null ? "Pendiente" : String(value);
      if (typeof value === "string" && /^[\s]*[=+@-]/.test(text))
        text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv =
      "\uFEFF" +
      [
        [
          "Fecha compra",
          "Material",
          "Unidad",
          "Cantidad",
          "Proveedor",
          "Documento",
          "Contenedor",
          "Costo total COP",
          "Costo unitario COP",
          "Estado",
        ],
        ...rows,
      ]
        .map((r) => r.map(encode).join(";"))
        .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `costos-mp-${month}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={download}
      disabled={!rows.length}
    >
      Exportar entradas CSV
    </Button>
  );
}
