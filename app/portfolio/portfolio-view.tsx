"use client";

import { useEffect, useState } from "react";
import type { HoldingValue, Portfolio } from "@/lib/calculations/portfolio";
import { Button, Card, Money } from "@/components/ui";

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
  return n >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]";
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
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm text-[var(--text-muted)]">Total market value</p>
          <div className="flex gap-[var(--sp-1)]">
            {portfolio.supportedCurrencies.map((c) => (
              <Button
                key={c}
                variant={c === activeTotal.currency ? "primary" : "secondary"}
                onClick={() => chooseTotalCurrency(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        <p className="break-words">
          <Money
            amount={activeTotal.marketValue}
            currency={activeTotal.currency}
            size="xl"
            className="font-semibold"
          />
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
        <p className="mt-2 text-xs text-[var(--text-subtle)]">
          Summed in {activeTotal.currency} · prices &amp; FX via Yahoo Finance ·
          as of {asOfLabel}
        </p>
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Holdings ({portfolio.holdings.length})
        </h2>

        {portfolio.holdings.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No holdings yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {portfolio.holdings.map((h) => {
              const display = holdingCurrencies[h.id] ?? h.nativeCurrency;
              const v = h.values[display] ?? h.values[h.nativeCurrency];
              const converted = display !== h.nativeCurrency;

              return (
                <li key={h.id} className="flex justify-between gap-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{h.ticker}</span>
                    <span className="text-sm text-[var(--text-muted)]">
                      {h.shares} sh
                      {h.price !== null
                        ? ` @ ${h.price} ${h.nativeCurrency}`
                        : ""}
                    </span>
                    {h.error && (
                      <span className="text-xs text-[var(--neg)]">{h.error}</span>
                    )}
                    {converted && v.fxRateMarket !== null && (
                      <span className="text-xs text-[var(--text-subtle)]">
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
                      <Button
                        variant="outline"
                        size="compact"
                        onClick={() => cycleHoldingCurrency(h)}
                        title="Switch this holding's display currency"
                      >
                        {display} ⇄
                      </Button>
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
