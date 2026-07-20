import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getPriceProvider } from "@/lib/prices";
import { assetCategoryLabel } from "@/lib/assets";

// Category-routed valuation engine. Real market data first (gold spot,
// depreciation), Claude only where no real data exists. Every result records a
// source and confidence and returns a low/high range — never a single number.

export type ValuationSource = "market" | "ai_estimate";
export type Confidence = "low" | "medium" | "high";
export type SourceLink = { url: string; title: string };

export type ValuationResult = {
  valueLow: number;
  valueHigh: number;
  currency: string;
  confidence: Confidence;
  source: ValuationSource;
  reasoning: string;
  sources: SourceLink[];
};

export type AssetForValuation = {
  name: string;
  category: string;
  description: string | null;
  currency: string;
  acquisition_cost: number | null;
  acquisition_date: string | null;
  details: Record<string, unknown> | null;
};

// Default to Haiku for cost — a stronger model is only reserved if a category
// genuinely needs it (none currently do).
const MODEL = "claude-haiku-4-5";
const GRAMS_PER_TROY_OUNCE = 31.1035;
const METAL_SYMBOLS: Record<string, string> = {
  gold: "GC=F",
  silver: "SI=F",
  platinum: "PL=F",
  palladium: "PA=F",
};

// The model submits its final range through this tool, so we never have to parse
// free-form text. strict:true guarantees the shape.
const submitTool = {
  name: "submit_valuation",
  description: "Submit the final estimated value range for the asset.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      value_low: { type: "number", description: "Low end of the value range." },
      value_high: { type: "number", description: "High end of the value range." },
      reasoning: {
        type: "string",
        description: "Concise explanation of how you reached the range.",
      },
    },
    required: ["value_low", "value_high", "reasoning"],
  },
  strict: true,
};

type SubmitInput = { value_low: number; value_high: number; reasoning: string };

// Haiku uses the basic web-search tool variant (the dynamic-filtering variant is
// gated to Opus/Sonnet tiers). Types are loose here to mix a server tool with a
// custom tool without SDK type friction.
async function callClaude(opts: {
  system: string;
  prompt: string;
  useWebSearch: boolean;
}): Promise<{ input: SubmitInput; sources: SourceLink[] }> {
  const client = new Anthropic();

  const tools: unknown[] = [];
  if (opts.useWebSearch) {
    tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 4 });
  }
  tools.push(submitTool);

  const messages: unknown[] = [{ role: "user", content: opts.prompt }];
  const sources: SourceLink[] = [];

  for (let round = 0; round < 4; round++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: opts.system,
      tools: tools as never,
      tool_choice: (opts.useWebSearch
        ? { type: "auto" }
        : { type: "tool", name: "submit_valuation" }) as never,
      messages: messages as never,
    });

    for (const block of resp.content as unknown[]) {
      const b = block as { type: string; content?: unknown };
      if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content as Array<{ type: string; url?: string; title?: string }>) {
          if (r?.type === "web_search_result" && r.url) {
            sources.push({ url: r.url, title: r.title ?? r.url });
          }
        }
      }
    }

    const submit = (resp.content as unknown[]).find((block) => {
      const b = block as { type: string; name?: string };
      return b.type === "tool_use" && b.name === "submit_valuation";
    }) as { input: SubmitInput } | undefined;

    if (submit) return { input: submit.input, sources };

    // Server-tool loop hit its per-turn cap — resend to let it continue.
    if (resp.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: resp.content });
      continue;
    }
    break;
  }

  throw new Error("The model finished without returning a valuation.");
}

function finalize(
  input: SubmitInput,
  opts: {
    currency: string;
    confidence: Confidence;
    source: ValuationSource;
    sources: SourceLink[];
    extraNote?: string;
  },
): ValuationResult {
  let low = Number(input.value_low);
  let high = Number(input.value_high);
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    throw new Error("The model returned an invalid range.");
  }
  low = Math.max(0, low);
  high = Math.max(0, high);
  if (high < low) [low, high] = [high, low];

  let reasoning = String(input.reasoning ?? "").trim();
  if (opts.extraNote) {
    reasoning = reasoning ? `${reasoning}\n\n${opts.extraNote}` : opts.extraNote;
  }

  return {
    valueLow: low,
    valueHigh: high,
    currency: opts.currency,
    confidence: opts.confidence,
    source: opts.source,
    reasoning,
    sources: opts.sources,
  };
}

// --- Strategy: precious metal → live spot × weight × purity (no AI) ---
async function goldStrategy(asset: AssetForValuation): Promise<ValuationResult> {
  const details = asset.details ?? {};
  const metal = String(details.metal ?? "gold").toLowerCase();
  const weight = Number(details.weight_grams);
  const purityRaw = Number(details.purity);

  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error("Add the weight (grams) to this asset before estimating.");
  }
  const purity = Number.isFinite(purityRaw) && purityRaw > 0 ? Math.min(purityRaw, 1) : 1;

  const symbol = METAL_SYMBOLS[metal] ?? METAL_SYMBOLS.gold;
  const provider = getPriceProvider();
  const quotes = await provider.getQuotes([symbol]);
  const quote = quotes.get(symbol);
  if (!quote) {
    throw new Error("Couldn't fetch the live spot price — try again shortly.");
  }

  const rate = await provider.getFxRate(quote.currency, asset.currency);
  if (rate == null) {
    throw new Error(`Couldn't convert ${quote.currency} to ${asset.currency}.`);
  }

  const pureOunces = (weight * purity) / GRAMS_PER_TROY_OUNCE;
  const value = pureOunces * quote.price * rate;

  const reasoning =
    `${metal} spot ${quote.price.toFixed(2)} ${quote.currency}/ozt × ${weight}g × ` +
    `${(purity * 100).toFixed(1)}% purity = ${pureOunces.toFixed(3)} ozt of pure metal. ` +
    `Converted at 1 ${quote.currency} = ${rate} ${asset.currency}. ±2% for dealer spread.`;

  return {
    valueLow: value * 0.98,
    valueHigh: value * 1.02,
    currency: asset.currency,
    confidence: "high",
    source: "market",
    reasoning,
    sources: [
      {
        url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`,
        title: `${metal} spot price (Yahoo ${symbol})`,
      },
    ],
  };
}

// --- Strategy: vehicle → depreciation from purchase price, age, mileage (no AI) ---
async function vehicleStrategy(asset: AssetForValuation): Promise<ValuationResult> {
  if (asset.acquisition_cost == null) {
    throw new Error("Set a purchase price before estimating a vehicle.");
  }
  const purchase = Number(asset.acquisition_cost);
  const boughtAt = asset.acquisition_date ? new Date(asset.acquisition_date) : null;
  const ageYears = boughtAt
    ? Math.max(0, (Date.now() - boughtAt.getTime()) / (365.25 * 24 * 3600 * 1000))
    : 0;

  // ~15%/year declining balance, floored at 10% of purchase.
  let retain = Math.max(Math.pow(0.85, ageYears), 0.1);

  const mileage = Number((asset.details ?? {}).mileage);
  let mileageNote = "mileage not provided";
  if (Number.isFinite(mileage) && mileage > 0) {
    const expected = 15000 * Math.max(ageYears, 0.1); // ~15,000 km/year
    const ratio = mileage / Math.max(expected, 1);
    const adjustment = Math.min(1.2, Math.max(0.6, 1 - (ratio - 1) * 0.3));
    retain *= adjustment;
    mileageNote = `${mileage.toLocaleString()} vs ~${Math.round(expected).toLocaleString()} expected (×${adjustment.toFixed(2)})`;
  }

  const value = purchase * retain;
  const reasoning =
    `Depreciation from purchase ${purchase.toLocaleString()} ${asset.currency}: ~15%/yr over ` +
    `${ageYears.toFixed(1)} years → retains ${(retain * 100).toFixed(0)}%. Mileage: ${mileageNote}. ±10% range.`;

  return {
    valueLow: value * 0.9,
    valueHigh: value * 1.1,
    currency: asset.currency,
    confidence: "medium",
    source: "market",
    reasoning,
    sources: [],
  };
}

// --- Strategy: trading card / watch / real estate → Claude + web-search comps ---
async function compsStrategy(asset: AssetForValuation): Promise<ValuationResult> {
  const currency = asset.currency;
  const label = assetCategoryLabel(asset.category);
  const confidence: Confidence = asset.category === "real_estate" ? "low" : "medium";

  const system =
    `You estimate the current resale value of a ${label}. Use web search to find RECENT ` +
    `comparable sales (roughly the last 12 months), preferring actual sold prices over asking ` +
    `prices. Then call submit_valuation with a realistic low–high resale range in ${currency} ` +
    `and a concise reasoning that cites the specific comparables you found.`;

  const prompt =
    `Item: ${asset.name}\nCategory: ${label}\n` +
    (asset.description ? `Details: ${asset.description}\n` : "") +
    (asset.acquisition_cost != null
      ? `Owner paid ${asset.acquisition_cost} ${currency}${asset.acquisition_date ? ` on ${asset.acquisition_date}` : ""}.\n`
      : "") +
    `Find recent comparable sales and estimate the current resale value range in ${currency}.`;

  const { input, sources } = await callClaude({ system, prompt, useWebSearch: true });
  return finalize(input, { currency, confidence, source: "ai_estimate", sources });
}

// --- Strategy: antique / jewelry / clothing / art / other → wide AI estimate ---
async function aiEstimateStrategy(asset: AssetForValuation): Promise<ValuationResult> {
  const currency = asset.currency;
  const label = assetCategoryLabel(asset.category);
  const note =
    "Estimate only — get a professional appraisal before relying on this value.";

  const system =
    `You are giving a rough, non-expert estimate of a ${label}'s current market value. You do NOT ` +
    `have specific comparable sales data. Provide a DELIBERATELY WIDE low–high range in ${currency} ` +
    `that honestly reflects high uncertainty — do not pretend to precision. Then call ` +
    `submit_valuation with the range and a brief reasoning.`;

  const prompt =
    `Item: ${asset.name}\nCategory: ${label}\n` +
    (asset.description ? `Details: ${asset.description}\n` : "") +
    `Give a wide, uncertain value range in ${currency}.`;

  const { input, sources } = await callClaude({ system, prompt, useWebSearch: false });
  return finalize(input, {
    currency,
    confidence: "low",
    source: "ai_estimate",
    sources,
    extraNote: note,
  });
}

/**
 * Whether a category's strategy calls the paid Claude API. Precious metals (live
 * spot price) and vehicles (depreciation maths) don't, so they aren't rate
 * limited. Mirrors the routing in estimateAssetValue below.
 */
export function usesAiValuation(category: string): boolean {
  return category !== "precious_metal" && category !== "vehicle";
}

/** Routes an asset to the right valuation strategy by category. */
export async function estimateAssetValue(
  asset: AssetForValuation,
): Promise<ValuationResult> {
  switch (asset.category) {
    case "precious_metal":
      return goldStrategy(asset);
    case "vehicle":
      return vehicleStrategy(asset);
    case "trading_card":
    case "watch":
    case "real_estate":
      return compsStrategy(asset);
    default:
      return aiEstimateStrategy(asset);
  }
}
