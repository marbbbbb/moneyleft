"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NetWorth } from "@/lib/calculations/networth";
import type { SnapshotPoint } from "@/lib/calculations/snapshots";
import { LiquidIlliquidPie } from "./liquid-illiquid-pie";
import { NetWorthTrend } from "./net-worth-trend";

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

  return (
    <>
      {/* Headline total */}
      <section className="rounded-lg border border-gray-200 p-6 dark:border-gray-800">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm uppercase tracking-wide text-gray-500">
            Total net worth
          </p>
          <div className="flex overflow-hidden rounded-md border border-gray-300 text-xs dark:border-gray-700">
            {netWorth.supportedCurrencies.map((c) => (
              <button
                key={c}
                onClick={() => chooseCurrency(c)}
                className={`px-3 py-2 ${
                  c === display
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : ""
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <p className="font-mono tracking-tight text-3xl font-bold break-words sm:text-4xl">
          {money(netWorth.total[display], display)}
        </p>
      </section>

      {/* At-a-glance liquid vs illiquid split */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Liquid vs illiquid
        </h2>
        <LiquidIlliquidPie
          liquid={netWorth.liquid[display]}
          illiquid={netWorth.illiquid[display]}
        />
      </section>

      {/* Net worth over time — forward-only history, see net-worth-trend.tsx */}
      <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Net worth over time
        </h2>
        <NetWorthTrend
          points={history.map((h) => ({
            date: h.snapshot_date,
            value: h.total[display] ?? 0,
          }))}
          currency={display}
        />
      </section>

      {/* Liquid / illiquid / liabilities breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* CASH & INVESTMENTS — prominent, populated. The box itself isn't a
            link (it's two things); each sub-line links out individually. */}
        <section className="rounded-lg border border-gray-200 p-5 dark:border-gray-800">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-green-700 dark:text-green-500">
              Cash &amp; Investments
            </h2>
            <span className="text-xs text-gray-400">cash + stocks</span>
          </div>
          <p className="font-mono mt-2 text-2xl font-semibold">
            {money(netWorth.liquid[display], display)}
          </p>
          <dl className="mt-4 flex flex-col gap-1 text-sm">
            <Link
              href="/cash"
              className="-mx-2 flex items-center justify-between rounded-[var(--r-sm)] px-2 py-1 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]"
            >
              <dt className="text-gray-500">Cash accounts</dt>
              <dd className="flex items-center gap-1">
                <span className="font-mono">{money(netWorth.cash[display], display)}</span>
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </dd>
            </Link>
            <Link
              href="/holdings"
              className="-mx-2 flex items-center justify-between rounded-[var(--r-sm)] px-2 py-1 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)]"
            >
              <dt className="text-gray-500">Stock holdings</dt>
              <dd className="flex items-center gap-1">
                <span className="font-mono">{money(netWorth.holdings[display], display)}</span>
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </dd>
            </Link>
          </dl>
        </section>

        {/* ASSETS — links to the asset vault */}
        <Link href="/assets" className="block">
          <section className="rounded-lg border border-dashed border-gray-300 p-5 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] dark:border-gray-700">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Assets
              </h2>
              <span className="flex items-center gap-1">
                <span className="text-xs text-gray-400">assets</span>
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </span>
            </div>
            <p
              className={`font-mono mt-2 text-2xl font-semibold ${
                netWorth.illiquid[display] > 0 ? "" : "text-gray-400"
              }`}
            >
              {money(netWorth.illiquid[display], display)}
            </p>
            {netWorth.assetCost[display] > 0 ? (
              <p
                className={`mt-1 text-sm ${
                  netWorth.assetGain[display] >= 0
                    ? "text-green-600"
                    : "text-red-600"
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
                <span className="text-gray-500">unrealized vs purchase</span>
              </p>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                Add assets in the vault to see illiquid net worth and unrealized
                gain here.
              </p>
            )}
          </section>
        </Link>

        {/* DEBTS — links to liabilities, subtracted from net worth */}
        <Link href="/liabilities" className="block">
          <section className="rounded-lg border border-gray-200 p-5 transition-colors hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] dark:border-gray-800">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-500">
                Debts
              </h2>
              <span className="flex items-center gap-1">
                <span className="text-xs text-gray-400">debts</span>
                <span className="text-[var(--text-subtle)]" aria-hidden="true">
                  →
                </span>
              </span>
            </div>
            <p
              className={`font-mono mt-2 text-2xl font-semibold ${
                netWorth.liabilities[display] > 0 ? "text-red-600" : "text-gray-400"
              }`}
            >
              {netWorth.liabilities[display] > 0 ? "−" : ""}
              {money(netWorth.liabilities[display], display)}
            </p>
            {netWorth.liabilities[display] > 0 ? (
              <p className="mt-1 text-sm text-gray-500">
                Subtracted from your net worth.
              </p>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No debts. Add a mortgage, loan, or card balance on the{" "}
                Liabilities page.
              </p>
            )}
          </section>
        </Link>
      </div>
    </>
  );
}
