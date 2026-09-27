export const CALI_TIME_ZONE = "America/Bogota";
export function caliDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CALI_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function auditFridays(start: string, today: string): string[] {
  const result: string[] = [];
  const date = new Date(`${start}T12:00:00Z`);
  while (date.toISOString().slice(0, 10) <= today) {
    result.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return result;
}
export type AuditItem = { key: string; material: string; code: string; unit: string; location: string; expected: number; physical?: number; difference?: number; reason?: string };
