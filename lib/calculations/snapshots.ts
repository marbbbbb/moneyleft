import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NetWorth } from "./networth";

export type SnapshotPoint = {
  snapshot_date: string;
  total: Record<string, number>;
  liquid: Record<string, number>;
  illiquid: Record<string, number>;
  liabilities: Record<string, number>;
};

/**
 * Upserts today's net worth as one row (one per user per day). Called on every
 * homepage load — the last computation of the day wins, so the snapshot always
 * reflects the freshest numbers without accumulating multiple rows per day.
 * Best-effort: a failure here should never break the net worth page.
 */
export async function recordNetWorthSnapshot(
  supabase: SupabaseClient,
  netWorth: NetWorth,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("net_worth_snapshots").upsert(
    {
      snapshot_date: today,
      total: netWorth.total,
      liquid: netWorth.liquid,
      illiquid: netWorth.illiquid,
      liabilities: netWorth.liabilities,
    },
    { onConflict: "user_id,snapshot_date" },
  );
}

/** Reads the recorded history, oldest first, for the trend chart. */
export async function getNetWorthHistory(
  supabase: SupabaseClient,
): Promise<SnapshotPoint[]> {
  const { data, error } = await supabase
    .from("net_worth_snapshots")
    .select("snapshot_date, total, liquid, illiquid, liabilities")
    .order("snapshot_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SnapshotPoint[];
}
