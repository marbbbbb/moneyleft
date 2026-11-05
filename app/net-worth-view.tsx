"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NetWorth } from "@/lib/calculations/networth";
import type { SnapshotPoint } from "@/lib/calculations/snapshots";
import { LiquidIlliquidPie } from "./liquid-illiquid-pie";
import { NetWorthTrend } from "./net-worth-trend";
import { Button, Card, Money } from "@/components/ui";

const TOTAL_KEY = "networth:totalCurrency";
const DEFAULT_TOTAL_CURRENCY = "TWD";

function money(n: number, currency: string): string {
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function NetWorthView({
  netWorth,
  history,
}: {
  netWorth: NetWorth;
  history: SnapshotPoint[];
}) {
  // Default matches the server render; the persisted choice loads in the effect.
  const [currency, setCurrency] = useState(DEFAULT_TOTAL_CURRENCY);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOTAL_KEY);
      if (saved) setCurrency(saved);
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, []);

  function chooseCurrency(c: string) {
    setCurrency(c);
    try {
      localStorage.setItem(TOTAL_KEY, c);
    } catch {}
  }

  // Guard against a stale/unknown saved currency.
  const display = netWorth.total[currency] !== undefined
    ? currency
    : netWorth.supportedCurrencies[0];

  // Cash (and therefore Cash & Investments, liquid, and total) is now the
  // same running balance the dashboard's "Money left" shows, not a raw
  // cash_accounts sum — see computeRunningCash. Two things follow from that:
  // a conversion may have happened to produce it, which needs the same
  // "Converted at" transparency the dashboard already gives; and if
  // cash_confirmed_at itself was unavailable, this is the plain cash total
  // with no income/expense adjustment, which the reader should know rather
  // than silently trusting it as the full running balance.
  const cashRateNote = netWorth.cashRateNotes[display]?.length
    ? `Converted at ${netWorth.cashRateNotes[display].join(", ")}.`
    : null;
  const cashConfirmedUnavailable = netWorth.cashConfirmedAt === null;

  return (
    <>
      {/* Headline total */}
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm uppercase tracking-wide text-[var(--text-muted)]">
            Total net worth
          </p>
          <div className="flex gap-[var(--sp-1)]">
            {netWorth.supportedCurrencies.map((c) => (
              <Button
                key={c}
                variant={c === display ? "primary" : "secondary"}
                onClick={() => chooseCurrency(c)}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>
        <p className="break-words">
          <Money
            amount={netWorth.total[display]}
            currency={display}
            size="xl"
            className="font-bold"
          />
        </p>
      </Card>

      {/* At-a-glance liquid vs illiquid split */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Liquid vs illiquid
        </h2>
        <LiquidIlliquidPie
          liquid={netWorth.liquid[display]}
          illiquid={netWorth.illiquid[display]}
        />
      </Card>

      {/* Net worth over time — forward-only history, see net-worth-trend.tsx */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Net worth over time
        </h2>
        <NetWorthTrend
          points={history.map((h) => ({
            date: h.snapshot_date,
            value: h.total[display] ?? 0,
          }))}
          currency={display}
        />
      </Card>

      {/* Liquid / illiquid / liabilities breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* CASH & INVESTMENTS — prominent, populated. The box itself isn't a
            link (it's two things); each sub-line links out individually. */}
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--pos)]">
              Cash &amp; Investments
            </h2>
            <span className="text-xs text-[var(--text-subtle)]">cash + stocks</span>
          </div>
          <p className="mt-2">
            <Money
              amount={netWorth.liquid[display]}
              currency={display}
              size="lg"
              className="font-semibold"
            />
          </p>
          <dl className="mt-4 flex flex-col gap-1 text-sm">
            <Link
              href="/cash"
              className="-mx-2 flex items-center justify-between rounded-[var(--r-sm)] px-2 py-1 transition-colors motion-reduce:transition-none hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]"
            >
              <dt className="text-[var(--text-muted)]">Cash accounts</dt>
              <dd className="flex items-center gap-1">
                <Money amount={netWorth.cash[display]} currency={display} size="sm" />
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </dd>
            </Link>
            {cashConfirmedUnavailable ? (
              <p className="text-xs text-[var(--text-subtle)]">
                Showing account balances only — we don&apos;t know when you
                last confirmed them.
              </p>
            ) : (
              cashRateNote && <p className="text-xs text-[var(--text-subtle)]">{cashRateNote}</p>
            )}
            <Link
              href="/holdings"
              className="-mx-2 flex items-center justify-between rounded-[var(--r-sm)] px-2 py-1 transition-colors motion-reduce:transition-none hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]"
            >
              <dt className="text-[var(--text-muted)]">Stock holdings</dt>
              <dd className="flex items-center gap-1">
                <Money amount={netWorth.holdings[display]} currency={display} size="sm" />
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </dd>
            </Link>
          </dl>
        </Card>

        {/* ASSETS — links to the asset vault */}
        <Link href="/assets" className="block">
          <Card className="border-dashed transition-colors motion-reduce:transition-none hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Assets
              </h2>
              <span className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-subtle)]">assets</span>
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </span>
            </div>
            <p className="mt-2">
              <Money
                amount={netWorth.illiquid[display]}
                currency={display}
                size="lg"
                className={`font-semibold ${
                  netWorth.illiquid[display] > 0 ? "" : "[--text:var(--text-subtle)]"
                }`}
              />
            </p>
            {netWorth.assetCost[display] > 0 ? (
              <p
                className={`mt-1 text-sm ${
                  netWorth.assetGain[display] >= 0
                    ? "text-[var(--pos)]"
                    : "text-[var(--neg)]"
                }`}
              >
                <span className="font-mono">
                  {netWorth.assetGain[display] >= 0 ? "+" : "−"}
                  {money(Math.abs(netWorth.assetGain[display]), display)}
                  {netWorth.assetGainPct[display] !== null &&
                    ` (${netWorth.assetGain[display] >= 0 ? "+" : "−"}${Math.abs(
                      netWorth.assetGainPct[display]!,
                    ).toFixed(1)}%)`}
                </span>{" "}
                <span className="text-[var(--text-muted)]">unrealized vs purchase</span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                Add assets in the vault to see illiquid net worth and unrealized
                gain here.
              </p>
            )}
          </Card>
        </Link>

        {/* DEBTS — links to liabilities, subtracted from net worth */}
        <Link href="/liabilities" className="block">
          <Card className="transition-colors motion-reduce:transition-none hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--neg)]">
                Debts
              </h2>
              <span className="flex items-center gap-1">
                <span className="text-xs text-[var(--text-subtle)]">debts</span>
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </span>
            </div>
            <p className="mt-2">
              <Money
                amount={-netWorth.liabilities[display]}
                currency={display}
                signed
                size="lg"
                className={`font-semibold ${
                  netWorth.liabilities[display] > 0 ? "" : "[--text:var(--text-subtle)]"
                }`}
              />
            </p>
            {netWorth.liabilities[display] > 0 ? (
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Subtracted from your net worth.
              </p>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">
                No debts. Add a mortgage, loan, or card balance on the{" "}
                Liabilities page.
              </p>
            )}
          </Card>
        </Link>
      </div>
    </>
  );
}
