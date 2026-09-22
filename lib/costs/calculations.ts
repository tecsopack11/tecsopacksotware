export type CostAmounts = {
  unit_price: number;
  exchange_rate: number;
  discount: number;
  freight: number;
  insurance: number;
  duties: number;
  other_costs: number;
};

export function landedCost(quantity: number, cost: CostAmounts) {
  if (
    ![quantity, ...Object.values(cost)].every(Number.isFinite) ||
    quantity <= 0 ||
    cost.unit_price <= 0 ||
    cost.exchange_rate <= 0 ||
    [
      cost.discount,
      cost.freight,
      cost.insurance,
      cost.duties,
      cost.other_costs,
    ].some((n) => n < 0) ||
    cost.discount >= quantity * cost.unit_price
  )
    return null;
  const goods =
    (quantity * cost.unit_price - cost.discount) * cost.exchange_rate;
  const expenses =
    cost.freight + cost.insurance + cost.duties + cost.other_costs;
  return {
    goods,
    expenses,
    total: goods + expenses,
    unit: (goods + expenses) / quantity,
  };
}

export type Movement = {
  id: string;
  material_id: string;
  quantity: number;
  movement_type: string;
  from_location_id: string | null;
  to_location_id: string | null;
  created_at: string;
  effective_date: string;
  valuation_sequence: number;
  cancelled_at: string | null;
  received_at: string | null;
  reference_doc: string | null;
  lot_id: string | null;
};
export type Valuation = {
  quantity: number;
  value: number | null;
  average: number | null;
  provisional: boolean;
  issue: boolean;
  transit: number;
};
type AppliedCost = { movement_id: string; total_cop: number; status: string };

/** Global MP pool: internal transfers retain value, including stock in transit.
 * Reconstructed operational valuation, NOT immutable historical OP costing.
 * Missing opening/receipt costs contaminate the pool until fully exhausted.
 */
export function valueInventory(
  movements: Movement[],
  costs: AppliedCost[],
  internalLocations: Set<string>,
) {
  const balances = new Map<string, Valuation>();
  const prices = new Map(costs.map((cost) => [cost.movement_id, cost]));
  const internal = (id: string | null) =>
    id !== null && internalLocations.has(id);
  for (const movement of [...movements].sort(
    (a, b) =>
      a.effective_date.localeCompare(b.effective_date) ||
      a.created_at.localeCompare(b.created_at) ||
      a.valuation_sequence - b.valuation_sequence ||
      a.id.localeCompare(b.id),
  )) {
    if (movement.cancelled_at) continue;
    const balance = balances.get(movement.material_id) ?? {
      quantity: 0,
      value: 0,
      average: null,
      provisional: false,
      issue: false,
      transit: 0,
    };
    balances.set(movement.material_id, balance);
    const from = internal(movement.from_location_id);
    const to = internal(movement.to_location_id);
    if (from && to) {
      if (movement.movement_type === "traslado" && !movement.received_at)
        balance.transit += movement.quantity;
      continue;
    }
    if (from === to) continue;
    const quantity = Number(movement.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      balance.issue = true;
      balance.value = null;
      balance.average = null;
      continue;
    }
    if (to) {
      // An inbound adjustment/return is not a purchase: its basis is unknown.
      const cost =
        movement.movement_type === "entrada"
          ? prices.get(movement.id)
          : undefined;
      balance.quantity += quantity;
      balance.value =
        cost && balance.value !== null && !balance.issue
          ? balance.value + Number(cost.total_cop)
          : null;
      balance.provisional ||= cost?.status === "provisional";
    } else {
      if (quantity > balance.quantity + 0.0000001) {
        balance.issue = true;
        balance.value = null;
      } else if (balance.value !== null && balance.quantity > 0) {
        balance.value *= (balance.quantity - quantity) / balance.quantity;
      }
      balance.quantity -= quantity;
    }
    if (Math.abs(balance.quantity) < 0.0000001) {
      balance.quantity = 0;
      // An inconsistent chronology stays flagged even after reaching zero.
      balance.value = balance.issue ? null : 0;
      balance.provisional = false;
    }
    balance.average =
      balance.quantity > 0 && balance.value !== null
        ? balance.value / balance.quantity
        : null;
  }
  return balances;
}

export function weightedPurchaseAverage(
  rows: { quantity: number; total: number | null }[],
) {
  let quantity = 0,
    total = 0,
    pending = 0;
  for (const row of rows) {
    if (row.total === null) {
      pending++;
      continue;
    }
    quantity += row.quantity;
    total += row.total;
  }
  return {
    average: quantity > 0 ? total / quantity : null,
    total,
    quantity,
    pending,
  };
}

export function formatCop(value: number | null) {
  return value === null
    ? "Pendiente"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 2,
      }).format(value);
}
