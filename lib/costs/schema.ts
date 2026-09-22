import { z } from "zod";

export function bogotaDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

const money = z.coerce.number().finite().min(0).max(999_999_999_999);
export const costSchema = z
  .object({
    purchase_date: z.iso
      .date()
      .refine(
        (date) => date <= bogotaDate(),
        "La fecha no puede estar en el futuro",
      ),
    supplier: z.string().trim().min(1, "Indica el proveedor").max(200),
    invoice: z
      .string()
      .trim()
      .min(1, "Indica la factura o documento de compra")
      .max(200),
    shipment: z.string().trim().max(200),
    currency: z.enum(["COP", "USD", "EUR"]),
    exchange_rate: z.coerce.number().finite().positive().max(999_999),
    unit_price: z.coerce
      .number()
      .finite()
      .positive("El precio debe ser mayor que cero")
      .max(999_999_999),
    discount: money,
    freight: money,
    insurance: money,
    duties: money,
    other_costs: money,
    recoverable_tax: money,
    allocation_note: z.string().trim().max(1000),
    status: z.enum(["provisional", "confirmed"]),
    reason: z
      .string()
      .trim()
      .min(3, "Explica el motivo del registro o corrección")
      .max(1000),
  })
  .superRefine((cost, ctx) => {
    if (cost.currency === "COP" && cost.exchange_rate !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "La tasa para COP debe ser 1",
        path: ["exchange_rate"],
      });
    }
    if (
      cost.freight + cost.insurance + cost.duties + cost.other_costs > 0 &&
      !cost.allocation_note
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Explica cómo distribuiste los gastos de compra",
        path: ["allocation_note"],
      });
    }
  });

export type CostInput = z.infer<typeof costSchema>;
export type CostRevision = CostInput & {
  id: string;
  movement_id: string;
  revision: number;
  total_cop: number;
  created_at: string;
  created_by: string;
};
export const receiptSchema = z.object({
  material_id: z.uuid(),
  to_location_id: z.uuid(),
  lot_code: z.string().trim().min(1, "Indica el lote").max(100),
  quantity: z.coerce
    .number()
    .finite()
    .positive()
    .max(999_999_999)
    .refine(
      (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 0.0001,
      "La cantidad admite máximo tres decimales",
    ),
});
