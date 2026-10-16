/** Values sent to actions stay canonical; only the visible text uses es-CO. */
export function matchesNumericValue(edited: string, value: ReactNumericValue): boolean {
  return typeof value === "number" ? Number(edited) === value : edited === String(value ?? "");
}

type ReactNumericValue = string | number | readonly string[] | undefined;

export function formatCanonicalNumber(value: string | number): string {
  let text = String(value);
  if (!text || text === "-") return text;
  if (!/^-?\d*(?:\.\d*)?$/.test(text)) {
    if (!Number.isFinite(Number(text))) return "";
    text = Number(text).toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  }
  const [integer, fraction] = text.split(".");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (fraction === undefined ? "" : `,${fraction}`);
}

export function parseColombianNumber(text: string): string | null {
  const clean = text.replace(/[\s\u00a0]/g, "");
  if (!/^-?[\d.]*,?\d*$/.test(clean)) return null;
  const canonical = clean.replace(/\./g, "").replace(",", ".");
  if (["", "-", ".", "-."].includes(canonical)) return "";
  const [integer, fraction] = canonical.split(".");
  const whole = integer.replace(/^(-?)0+(?=\d)/, "$1") || "0";
  return whole + (fraction ? `.${fraction}` : "");
}

export function numericInputError(value: string, options: {
  min?: string | number; max?: string | number; step?: string | number;
  required?: boolean; text?: string;
}): string {
  if (value === "") return options.required ? "Ingresa una cantidad válida." : options.text?.trim() ? "Completa el número." : "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Ingresa un número válido.";
  if (options.min !== undefined && number < Number(options.min)) return `El mínimo es ${formatCanonicalNumber(options.min)}.`;
  if (options.max !== undefined && number > Number(options.max)) return `El máximo es ${formatCanonicalNumber(options.max)}.`;
  if (options.step !== "any") {
    const step = Number(options.step ?? 1);
    const multiple = (number - Number(options.min ?? 0)) / step;
    const tolerance = Math.max(1e-7, Number.EPSILON * Math.abs(multiple) * 4);
    if (step > 0 && Math.abs(multiple - Math.round(multiple)) > tolerance) return `Usa incrementos de ${formatCanonicalNumber(step)}.`;
  }
  return "";
}
