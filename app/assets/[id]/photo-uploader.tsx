"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Uploads images straight to Supabase Storage from the browser, then records a
// row per file. The storage path starts with the user id, which the bucket's
// RLS policy requires (see supabase/002_networth_schema.sql).
export function PhotoUploader({
  userId,
  assetId,
}: {
  userId: string;
  assetId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();

    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${assetId}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("asset-photos")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { error: rowError } = await supabase
          .from("asset_photos")
          .insert({ asset_id: assetId, storage_path: path });
        if (rowError) throw rowError;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={onChange}
        disabled={busy}
        className="text-sm"
      />
      {busy && <p className="text-gray-500">Uploading…</p>}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
