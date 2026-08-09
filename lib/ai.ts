import "server-only";

import type { EstimateCategory, EstimateLineItemInput } from "@/lib/pricing";

export type EstimateGenerationInput = {
  title?: string;
  trade?: string;
  jobDescription: string;
  measurements?: string;
  voiceTranscript?: string;
  photoSummaries?: string[];
};

export type GeneratedEstimateDraft = {
  source: "openai" | "demo";
  scopeOfWork: string;
  assumptions: string[];
  exclusions: string[];
  items: EstimateLineItemInput[];
  warnings: string[];
};

const validCategories: EstimateCategory[] = ["MATERIAL", "LABOR", "EQUIPMENT", "DISPOSAL", "PERMIT", "OTHER"];

const ESTIMATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scopeOfWork", "assumptions", "exclusions", "items", "warnings"],
  properties: {
    scopeOfWork: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    exclusions: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "description", "quantity", "unit", "unitCostCents", "taxable", "markupEligible"],
        properties: {
          category: { type: "string", enum: validCategories },
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          unitCostCents: { type: "integer" },
          taxable: { type: "boolean" },
          markupEligible: { type: "boolean" },
        },
      },
    },
  },
} as const;

function truncate(value: string | undefined, maximum: number) {
  return value?.trim().slice(0, maximum) || undefined;
}

function cleanTextList(value: unknown, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, 400))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeItem(value: unknown): EstimateLineItemInput | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const category = typeof item.category === "string" ? item.category.toUpperCase() : "";
  if (!validCategories.includes(category as EstimateCategory)) return null;
  const description = typeof item.description === "string" ? item.description.trim().slice(0, 240) : "";
  const quantity = typeof item.quantity === "number" ? item.quantity : 0;
  const unit = typeof item.unit === "string" ? item.unit.trim().slice(0, 40) : "each";
  const unitCostCents = typeof item.unitCostCents === "number" ? Math.round(item.unitCostCents) : 0;
  if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 || unitCostCents < 0) return null;

  return {
    category: category as EstimateCategory,
    description,
    quantity,
    unit: unit || "each",
    unitCostCents: Math.min(unitCostCents, 100_000_000),
    taxable: item.taxable === true,
    markupEligible: item.markupEligible !== false,
  };
}

function normalizedDraft(value: unknown, source: GeneratedEstimateDraft["source"]): GeneratedEstimateDraft {
  if (!value || typeof value !== "object") throw new Error("The AI returned an invalid estimate draft.");
  const draft = value as Record<string, unknown>;
  const items = Array.isArray(draft.items) ? draft.items.map(normalizeItem).filter(Boolean) as EstimateLineItemInput[] : [];
  if (!items.length) throw new Error("The AI returned no usable estimate items.");

  const scopeOfWork = typeof draft.scopeOfWork === "string" ? draft.scopeOfWork.trim().slice(0, 4_000) : "";
  if (!scopeOfWork) throw new Error("The AI returned no scope of work.");

  return {
    source,
    scopeOfWork,
    assumptions: cleanTextList(draft.assumptions),
    exclusions: cleanTextList(draft.exclusions),
    items,
    warnings: cleanTextList(draft.warnings),
  };
}

function findLinearFeet(text: string) {
  const match = text.match(/\b(\d{1,5}(?:\.\d+)?)\s*(?:linear\s*)?(?:ft|feet|foot|lf)\b/i);
  return match ? Math.max(1, Math.round(Number(match[1]))) : undefined;
}

/** A clearly labeled preview draft for local development and sales demos. */
export function createDemoEstimate(input: EstimateGenerationInput): GeneratedEstimateDraft {
  const context = `${input.title ?? ""} ${input.trade ?? ""} ${input.jobDescription} ${input.measurements ?? ""} ${input.voiceTranscript ?? ""}`;
  const feet = findLinearFeet(context);
  const isFence = /fence|cedar|gate/i.test(context);

  const items: EstimateLineItemInput[] = isFence && feet
    ? [
        { category: "MATERIAL", description: "Cedar privacy fence materials", quantity: feet, unit: "LF", unitCostCents: 2150, taxable: true },
        { category: "MATERIAL", description: "Pressure-treated posts and concrete", quantity: Math.ceil(feet / 8) + 1, unit: "each", unitCostCents: 2950, taxable: true },
        { category: "LABOR", description: "Fence layout and installation labor", quantity: Math.max(8, Math.ceil(feet / 12)), unit: "hour", unitCostCents: 8500, taxable: false },
        { category: "EQUIPMENT", description: "Post-hole auger and trailer", quantity: 1, unit: "day", unitCostCents: 16500, taxable: false },
        { category: "DISPOSAL", description: "Site cleanup and haul-away allowance", quantity: 1, unit: "allowance", unitCostCents: 17500, taxable: false, markupEligible: false },
      ]
    : [
        { category: "MATERIAL", description: "Materials and job consumables allowance", quantity: 1, unit: "allowance", unitCostCents: 42000, taxable: true },
        { category: "LABOR", description: "On-site installation labor", quantity: 8, unit: "hour", unitCostCents: 8500, taxable: false },
        { category: "EQUIPMENT", description: "Specialty tools and site setup", quantity: 1, unit: "day", unitCostCents: 12500, taxable: false },
      ];

  return {
    source: "demo",
    scopeOfWork: `Provide labor, materials, equipment, and cleanup required for ${input.title ?? "the described work"}. Final field conditions and selected materials will be confirmed before work begins.`,
    assumptions: [
      "Pricing is a planning estimate and requires contractor review.",
      "Site access is clear and work can be performed during normal business hours.",
    ],
    exclusions: ["Permits, engineering, and concealed conditions unless specifically listed."],
    items,
    warnings: ["Demo pricing is illustrative. Replace it with your company price book before sending a proposal."],
  };
}

export function isAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateEstimateDraft(input: EstimateGenerationInput): Promise<GeneratedEstimateDraft> {
  if (!isAiConfigured()) return createDemoEstimate(input);

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const facts = {
    title: truncate(input.title, 160),
    trade: truncate(input.trade, 80),
    jobDescription: truncate(input.jobDescription, 6_000),
    measurements: truncate(input.measurements, 3_000),
    voiceTranscript: truncate(input.voiceTranscript, 6_000),
    photoSummaries: (input.photoSummaries ?? []).map((summary) => truncate(summary, 600)).filter(Boolean).slice(0, 12),
  };

  const response = await client.responses.create({
    model: process.env.OPENAI_ESTIMATE_MODEL ?? "gpt-4.1-mini",
    instructions: [
      "You help specialty contractors prepare an internal estimate draft.",
      "Use only the supplied job facts. Never claim to have inspected images or conditions not described in the facts.",
      "Provide concise scope, explicit assumptions/exclusions, and reviewable line items.",
      "Cost figures are planning allowances in cents, not supplier quotes. Flag uncertainty in warnings.",
      "Do not include personal data beyond what is necessary for the job.",
    ].join(" "),
    input: JSON.stringify(facts),
    text: {
      format: {
        type: "json_schema",
        name: "contractor_estimate_draft",
        strict: true,
        schema: ESTIMATE_SCHEMA,
      },
    },
  });

  return normalizedDraft(JSON.parse(response.output_text), "openai");
}
