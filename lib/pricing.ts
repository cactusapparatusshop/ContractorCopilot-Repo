export type EstimateCategory = "MATERIAL" | "LABOR" | "EQUIPMENT" | "DISPOSAL" | "PERMIT" | "OTHER";

export type EstimateLineItemInput = {
  category: EstimateCategory;
  description: string;
  quantity: number;
  unit: string;
  unitCostCents: number;
  taxable?: boolean;
  markupEligible?: boolean;
};

export type PricingSettings = {
  markupBps: number;
  taxRateBps: number;
  currency?: string;
};

export type PricedEstimateLineItem = EstimateLineItemInput & {
  costTotalCents: number;
  markupCents: number;
  lineTotalCents: number;
  unitPriceCents: number;
};

export type PricingSummary = {
  currency: string;
  lineItems: PricedEstimateLineItem[];
  materialSubtotalCents: number;
  laborSubtotalCents: number;
  equipmentSubtotalCents: number;
  disposalSubtotalCents: number;
  otherSubtotalCents: number;
  subtotalCents: number;
  markupCents: number;
  taxCents: number;
  totalCents: number;
};

const categories: EstimateCategory[] = ["MATERIAL", "LABOR", "EQUIPMENT", "DISPOSAL", "PERMIT", "OTHER"];

function roundCents(value: number) {
  return Math.round(value);
}

function isSafeCents(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 100_000_000;
}

export function calculateEstimate(
  lineItems: EstimateLineItemInput[],
  settings: PricingSettings,
): PricingSummary {
  if (!Array.isArray(lineItems) || !lineItems.length) throw new Error("At least one estimate item is required.");
  if (!Number.isInteger(settings.markupBps) || settings.markupBps < 0 || settings.markupBps > 100_000) {
    throw new Error("Markup must be between 0 and 1000%.");
  }
  if (!Number.isInteger(settings.taxRateBps) || settings.taxRateBps < 0 || settings.taxRateBps > 25_000) {
    throw new Error("Tax rate must be between 0 and 250%.");
  }

  const validated = lineItems.map((item) => {
    if (!categories.includes(item.category)) throw new Error("An estimate item has an invalid category.");
    const description = item.description?.trim();
    if (!description) throw new Error("Every estimate item needs a description.");
    if (description.length > 240) throw new Error("Estimate item descriptions must be 240 characters or fewer.");
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1_000_000) {
      throw new Error("Estimate quantities must be between 0 and 1,000,000.");
    }
    if (!isSafeCents(item.unitCostCents)) throw new Error("Unit costs must be valid non-negative cents.");

    return { ...item, description, costTotalCents: roundCents(item.quantity * item.unitCostCents) };
  });

  const markupBaseCents = validated
    .filter((item) => item.markupEligible !== false && item.category !== "PERMIT")
    .reduce((total, item) => total + item.costTotalCents, 0);
  const markupCents = roundCents((markupBaseCents * settings.markupBps) / 10_000);

  let allocatedMarkup = 0;
  const pricedItems = validated.map((item, index) => {
    const eligible = item.markupEligible !== false && item.category !== "PERMIT";
    const isLastEligible = eligible && !validated.slice(index + 1).some((candidate) => candidate.markupEligible !== false && candidate.category !== "PERMIT");
    const itemMarkup = !eligible
      ? 0
      : isLastEligible
        ? markupCents - allocatedMarkup
        : roundCents((item.costTotalCents / Math.max(markupBaseCents, 1)) * markupCents);
    allocatedMarkup += itemMarkup;
    const lineTotalCents = item.costTotalCents + itemMarkup;

    return {
      ...item,
      markupCents: itemMarkup,
      lineTotalCents,
      unitPriceCents: roundCents(lineTotalCents / item.quantity),
    };
  });

  const taxableTotalCents = pricedItems
    .filter((item) => item.taxable)
    .reduce((total, item) => total + item.lineTotalCents, 0);
  const taxCents = roundCents((taxableTotalCents * settings.taxRateBps) / 10_000);
  const sum = (category: EstimateCategory) =>
    pricedItems.filter((item) => item.category === category).reduce((total, item) => total + item.costTotalCents, 0);
  const subtotalCents = pricedItems.reduce((total, item) => total + item.costTotalCents, 0);

  return {
    currency: settings.currency?.toLowerCase() ?? "usd",
    lineItems: pricedItems,
    materialSubtotalCents: sum("MATERIAL"),
    laborSubtotalCents: sum("LABOR"),
    equipmentSubtotalCents: sum("EQUIPMENT"),
    disposalSubtotalCents: sum("DISPOSAL"),
    otherSubtotalCents: sum("OTHER") + sum("PERMIT"),
    subtotalCents,
    markupCents,
    taxCents,
    totalCents: subtotalCents + markupCents + taxCents,
  };
}

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
