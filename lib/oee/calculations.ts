export type OeeInput = {
  planned_production_seconds: number;
  run_seconds: number;
  good_qty: number;
  reject_qty: number;
  ideal_run_rate_per_hour: number | null;
};

export type OeeResult = {
  availability: number;
  performance: number;
  quality: number;
  oee: number;
};

export function calculateOee(input: OeeInput): OeeResult {
  const { planned_production_seconds, run_seconds, good_qty, reject_qty, ideal_run_rate_per_hour } = input;

  const totalQty = good_qty + reject_qty;

  const availability =
    planned_production_seconds > 0
      ? clamp(run_seconds / planned_production_seconds)
      : 0;

  const runHours = run_seconds / 3600;
  const performance =
    ideal_run_rate_per_hour && runHours > 0
      ? clamp(totalQty / runHours / ideal_run_rate_per_hour)
      : 0;

  const quality = totalQty > 0 ? clamp(good_qty / totalQty) : 0;

  const oee = availability * performance * quality;

  return { availability, performance, quality, oee };
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
