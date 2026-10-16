"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { formatCanonicalNumber, matchesNumericValue, numericInputError, parseColombianNumber } from "@/lib/numbers"

function ColombianNumberInput({ value, defaultValue, name, onChange, min, max, step, ref, ...props }: React.ComponentProps<"input">) {
  const controlled = value !== undefined;
  const external = String(value ?? defaultValue ?? "");
  const [edit, setEdit] = React.useState({ external, text: formatCanonicalNumber(external) });
  if (controlled && !matchesNumericValue(edit.external, value)) {
    setEdit({ external, text: formatCanonicalNumber(external) });
  }
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const canonical = parseColombianNumber(edit.text) ?? "";
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(numericInputError(canonical, { min, max, step, required: props.required, text: edit.text }));
  }, [canonical, min, max, step, props.required, edit.text]);
  React.useEffect(() => {
    if (controlled) return;
    const form = inputRef.current?.form;
    const reset = () => setEdit({ external, text: formatCanonicalNumber(external) });
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [controlled, external]);
  return <>
    {name && <input type="hidden" name={name} value={canonical} disabled={props.disabled} form={props.form} />}
    <input {...props} type="text" inputMode="decimal" lang="es-CO" value={edit.text}
      ref={(node) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      onChange={(event) => {
        const text = event.target.value;
        const parsed = parseColombianNumber(text);
        if (parsed === null) return;
        // Preserve a trailing comma/decimal zeros while keeping actions and calculations canonical.
        const raw = text.replace(/[\s.]/g, "").replace(",", ".");
        const formatted = formatCanonicalNumber(raw);
        const caret = event.target.selectionStart ?? text.length;
        const significant = text.slice(0, caret).replace(/\./g, "").length;
        setEdit({ external: parsed, text: formatted });
        event.target.setCustomValidity(numericInputError(parsed, { min, max, step, required: props.required, text: formatted }));
        if (onChange) {
          const target = new Proxy(event.target, {
            get(target, key) {
              if (key === "value") return parsed;
              if (key === "valueAsNumber") return parsed === "" ? NaN : Number(parsed);
              const property = Reflect.get(target, key, target);
              return typeof property === "function" ? property.bind(target) : property;
            },
          });
          onChange({ ...event, target, currentTarget: target });
        }
        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input || document.activeElement !== input) return;
          let position = 0, count = 0;
          while (position < formatted.length && count < significant) {
            if (formatted[position] !== ".") count++;
            position++;
          }
          input.setSelectionRange(position, position);
        });
      }} />
  </>
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const Component = type === "number" || (props.readOnly && typeof props.value === "number") ? ColombianNumberInput : InputPrimitive
  return (
    <Component
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
