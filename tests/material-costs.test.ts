import assert from "node:assert/strict";
import test from "node:test";
import {
  landedCost,
  valueInventory,
  weightedPurchaseAverage,
  type Movement,
} from "../lib/costs/calculations.ts";

const internal = new Set(["warehouse", "floor"]);
function movement(
  id: string,
  quantity: number,
  type = "entrada",
  extras: Partial<Movement> = {},
): Movement {
  return {
    id,
    valuation_sequence: Number(id),
    material_id: "pead",
    quantity,
    movement_type: type,
    created_at: `2026-09-${id.padStart(2, "0")}T12:00:00Z`,
    effective_date: `2026-09-${id.padStart(2, "0")}`,
    cancelled_at: null,
    received_at: null,
    reference_doc: null,
    lot_id: null,
    from_location_id: type === "entrada" ? null : "warehouse",
    to_location_id: type === "entrada" ? "warehouse" : null,
    ...extras,
  };
}
const cost = (id: string, total: number, status = "confirmed") => ({
  movement_id: id,
  total_cop: total,
  status,
});
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} ≠ ${expected}`);

test("container example: quantities weight the price", () => {
  const rows = [movement("1", 2900), movement("2", 24000)];
  const prices = [cost("1", 2900 * 5000), cost("2", 24000 * 3900)];
  const b = valueInventory(rows, prices, internal).get("pead")!;
  assert.equal(b.quantity, 26900);
  close(b.average!, 4018.5873605947956);
  assert.equal(b.value, 108100000);
});
test("stock consumed before container does not dilute its inventory price", () => {
  const b = valueInventory(
    [movement("1", 2900), movement("2", 2900, "consumo"), movement("3", 24000)],
    [cost("1", 14500000), cost("3", 93600000)],
    internal,
  ).get("pead")!;
  assert.equal(b.average, 3900);
  close(
    weightedPurchaseAverage([
      { quantity: 2900, total: 14500000 },
      { quantity: 24000, total: 93600000 },
    ]).average!,
    4018.5873605947956,
  );
});
test("partial consumption is valued at the moving average", () => {
  const b = valueInventory(
    [movement("1", 1000), movement("2", 400, "consumo"), movement("3", 2000)],
    [cost("1", 5000000), cost("3", 12000000)],
    internal,
  ).get("pead")!;
  assert.equal(b.quantity, 2600);
  close(b.average!, 15000000 / 2600);
});
test("internal transfer retains value while awaiting receipt", () => {
  const b = valueInventory(
    [
      movement("1", 1000),
      movement("2", 400, "traslado", { to_location_id: "floor" }),
    ],
    [cost("1", 5000000)],
    internal,
  ).get("pead")!;
  assert.equal(b.quantity, 1000);
  assert.equal(b.value, 5000000);
  assert.equal(b.transit, 400);
});
test("missing receipt cost is not zero and persists until stock is exhausted", () => {
  let b = valueInventory(
    [movement("1", 10), movement("2", 10)],
    [cost("2", 100)],
    internal,
  ).get("pead")!;
  assert.equal(b.value, null);
  b = valueInventory(
    [movement("1", 10), movement("2", 10, "salida"), movement("3", 10)],
    [cost("3", 100)],
    internal,
  ).get("pead")!;
  assert.equal(b.average, 10);
});
test("canceled receipt and its cost are excluded", () => {
  const b = valueInventory(
    [
      movement("1", 100, "entrada", { cancelled_at: "2026-09-02" }),
      movement("2", 10),
    ],
    [cost("1", 5000), cost("2", 100)],
    internal,
  ).get("pead")!;
  assert.equal(b.quantity, 10);
  assert.equal(b.value, 100);
});
test("returns/positive adjustments stay unvalued without their original basis", () => {
  const b = valueInventory(
    [
      movement("1", 10),
      movement("2", 5, "ajuste", {
        from_location_id: null,
        to_location_id: "warehouse",
      }),
    ],
    [cost("1", 100)],
    internal,
  ).get("pead")!;
  assert.equal(b.value, null);
});
test("negative historical balance is explicitly flagged", () => {
  const b = valueInventory(
    [movement("1", 10, "consumo"), movement("2", 20)],
    [cost("2", 100)],
    internal,
  ).get("pead")!;
  assert.equal(b.issue, true);
  assert.equal(b.value, null);
});
test("effective date, not posting date, orders daily registers", () => {
  const b = valueInventory(
    [
      movement("1", 10, "consumo", { effective_date: "2026-09-03" }),
      movement("2", 20, "entrada", {
        movement_type: "entrada",
        from_location_id: null,
        to_location_id: "warehouse",
        effective_date: "2026-09-01",
      }),
    ],
    [cost("2", 100)],
    internal,
  ).get("pead")!;
  assert.equal(b.issue, false);
  assert.equal(b.value, 50);
});
test("currency, discount and attributable expenses; tax excluded", () => {
  const values = {
    unit_price: 2,
    exchange_rate: 4000,
    discount: 100,
    freight: 300000,
    insurance: 10000,
    duties: 50000,
    other_costs: 40000,
  };
  const result = landedCost(1000, values)!;
  assert.equal(result.total, 8000000);
  assert.equal(result.unit, 8000);
  assert.equal(landedCost(0, values), null);
  assert.equal(landedCost(10, { ...values, discount: 20 }), null);
  assert.equal(landedCost(10, { ...values, discount: 0, freight: -1 }), null);
});
test("monthly missing costs report incomplete averages", () => {
  const result = weightedPurchaseAverage([
    { quantity: 10, total: null },
    { quantity: 20, total: 200 },
  ]);
  assert.equal(result.pending, 1);
  assert.equal(result.average, 10);
  assert.equal(result.quantity, 20);
});

test("same transaction entry and exit follow insertion sequence, not random UUID", () => {
  const common = {
    created_at: "2026-09-01T12:00:00Z",
    effective_date: "2026-09-01",
  };
  const receipt = movement("z-receipt", 10, "entrada", {
    ...common,
    valuation_sequence: 1,
  });
  const exit = movement("a-exit", 5, "consumo", {
    ...common,
    valuation_sequence: 2,
  });
  const b = valueInventory(
    [exit, receipt],
    [cost(receipt.id, 100)],
    internal,
  ).get("pead")!;
  assert.equal(b.issue, false);
  assert.equal(b.value, 50);
});
