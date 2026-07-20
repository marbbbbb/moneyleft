"use client";

import { useEffect, useState } from "react";
import type { HoldingValue, Portfolio } from "@/lib/calculations/portfolio";

const TOTAL_KEY = "portfolio:totalCurrency";
const HOLDINGS_KEY = "portfolio:holdingCurrencies";
const DEFAULT_TOTAL_CURRENCY = "TWD";

function money(n: number | null, currency: string): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function gainClass(n: number): string {
  return n >= 0 ? "text-green-600" : "text-red-600";
}

function signedMoney(n: number, currency: string, pct: number | null): string {
  const sign = n >= 0 ? "+" : "−";
  const pctPart =
    pct !== null ? ` (${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%)` : "";
  return `${sign}${money(Math.abs(n), currency)}${pctPart}`;
}

export function PortfolioView({ portfolio }: { portfolio: Portfolio }) {
  // Defaults match the server render to avoid a hydration mismatch; persisted
  // choices are loaded in the effect below and then take over.
  const [totalCurrency, setTotalCurrency] = useState(DEFAULT_TOTAL_CURRENCY);
  const [holdingCurrencies, setHoldingCurrencies] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    try {
      const savedTotal = localStorage.getItem(TOTAL_KEY);
      if (savedTotal) setTotalCurrency(savedTotal);
      const savedHoldings = localStorage.getItem(HOLDINGS_KEY);
      if (savedHoldings) setHoldingCurrencies(JSON.parse(savedHoldings));
    } catch {
      // localStorage unavailable — fall back to defaults.
    }
  }, []);

  function chooseTotalCurrency(currency: string) {
    setTotalCurrency(currency);
    try {
      localStorage.setItem(TOTAL_KEY, currency);
    } catch {}
  }

  function cycleHoldingCurrency(h: HoldingValue) {
    const current = holdingCurrencies[h.id] ?? h.nativeCurrency;
    const list = h.availableCurrencies;
    const next = list[(list.indexOf(current) + 1) % list.length];
    const updated = { ...holdingCurrencies, [h.id]: next };
    setHoldingCurrencies(updated);
    try {
      localStorage.setItem(HOLDINGS_KEY, JSON.stringify(updated));
    } catch {}
  }

  const activeTotal =
    portfolio.totals[totalCurrency] ??
    portfolio.totals[portfolio.supportedCurrencies[0]];
  const asOfLabel = new Date(portfolio.asOf).toLocaleString();

  return (
    <>
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm text-gray-500">Total market value</p>
          <div className="flex overflow-hidden rounded-md border border-gray-300 text-xs dark:border-gray-700">
            {portfolio.supportedCurrencies.map((c) => (
              <button
                key={c}
                onClick={() => chooseTotalCurrency(c)}
                className={`px-3 py-2 ${
                  c === activeTotal.currency
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : ""
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <p className="text-2xl font-semibold break-words sm:text-3xl">
          {money(activeTotal.marketValue, activeTotal.currency)}
        </p>
        <p className="mt-1 text-sm">
          Cost {money(activeTotal.cost, activeTotal.currency)} ·{" "}
          <span className={gainClass(activeTotal.gain)}>
            {signedMoney(
              activeTotal.gain,
              activeTotal.currency,
              activeTotal.gainPct,
            )}
          </span>
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Summed in {activeTotal.currency} · prices &amp; FX via Yahoo Finance ·
          as of {asOfLabel}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Holdings ({portfolio.holdings.length})
        </h2>

        {portfolio.holdings.length === 0 ? (
          <p className="text-sm text-gray-500">No holdings yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
            {portfolio.holdings.map((h) => {
              const display = holdingCurrencies[h.id] ?? h.nativeCurrency;
              const v = h.values[display] ?? h.values[h.nativeCurrency];
              const converted = display !== h.nativeCurrency;

              return (
                <li key={h.id} className="flex justify-between gap-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{h.ticker}</span>
                    <span className="text-sm text-gray-500">
                      {h.shares} sh
                      {h.price !== null
                        ? ` @ ${h.price} ${h.nativeCurrency}`
                        : ""}
                    </span>
                    {h.error && (
                      <span className="text-xs text-red-600">{h.error}</span>
                    )}
                    {converted && v.fxRateMarket !== null && (
                      <span className="text-xs text-gray-400">
                        FX 1 {h.nativeCurrency} = {v.fxRateMarket} {display} · as
                        of {asOfLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium">
                      {money(v.marketValue, display)}
                    </span>
                    {v.gain !== null && (
                      <span className={`text-sm ${gainClass(v.gain)}`}>
                        {signedMoney(v.gain, display, v.gainPct)}
                      </span>
                    )}
                    {h.availableCurrencies.length > 1 && (
                      <button
                        onClick={() => cycleHoldingCurrency(h)}
                        title="Switch this holding's display currency"
                        className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
                      >
                        {display} ⇄
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
