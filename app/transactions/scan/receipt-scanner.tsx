"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { parseEInvoiceQR, type ParsedInvoice } from "@/lib/einvoice";
import { suggestExistingCategory } from "@/lib/categories";
import { Button, Card, Field, Input } from "@/components/ui";

type FormState = { error?: string; ok?: true; duplicateTransactionId?: string };
type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

type CameraError = "denied" | "no-camera" | "insecure" | "generic";

// Fraction of the frame's shorter side used for the centred decode crop. The
// on-screen guide box is drawn to the same rectangle so the user aims inside
// exactly what jsQR sees.
const CROP_FRACTION = 0.8;

// Mirrors MANAGE_LINK_CLASS in app/dashboard/page.tsx: <Button variant="secondary">
// styling on a real <a>, since a <button> inside a <Link> is invalid HTML for
// pure navigation.
const SECONDARY_LINK =
  "inline-flex items-center justify-center px-[var(--sp-3)] py-[var(--sp-2)] rounded-[var(--r-sm)] text-[length:var(--t-sm)] font-medium bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]";

export function ReceiptScanner({
  action,
  categories,
}: {
  action: FormAction;
  categories: string[];
}) {
  const [parsed, setParsed] = useState<ParsedInvoice | null>(null);

  // Mounting the camera stage only while `parsed` is null means switching to
  // the review sheet unmounts it, and its effect cleanup stops the stream -
  // there is no code path that leaves the camera running behind the sheet.
  return parsed ? (
    <ReviewSheet
      parsed={parsed}
      categories={categories}
      action={action}
      onRescan={() => setParsed(null)}
    />
  ) : (
    <CameraStage onDetect={setParsed} />
  );
}

function CameraStage({ onDetect }: { onDetect: (p: ParsedInvoice) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<CameraError | null>(null);
  // Guide-box insets as % of the displayed video, derived from the real frame
  // size once it's known. Defaults keep a sane box before metadata loads.
  const [guide, setGuide] = useState({ x: 15, y: 15 });

  const syncGuide = () => {
    const video = videoRef.current;
    if (!video) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const side = CROP_FRACTION * Math.min(vw, vh);
    setGuide({
      x: ((vw - side) / 2 / vw) * 100,
      y: ((vh - side) / 2 / vh) * 100,
    });
  };

  // `onDetect` is ReceiptScanner's `setParsed` state setter - a stable
  // identity - so listing it as a dep does not restart the camera.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let tick = 0;

    const stopEverything = () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };

    const scanFrame = () => {
      if (stopped) return;
      raf = requestAnimationFrame(scanFrame);

      // Decode every other frame. A native-resolution crop is more pixels than
      // a downscaled full frame, so this buys headroom without dropping the
      // resolution jsQR needs to resolve a dense e-invoice QR.
      tick += 1;
      if (tick % 2 !== 0) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_CURRENT_DATA) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      // Centred square crop, taken at the camera's native resolution (no
      // downscale) - the guide box overlay marks the same region.
      const side = Math.round(CROP_FRACTION * Math.min(vw, vh));
      const sx = Math.round((vw - side) / 2);
      const sy = Math.round((vh - side) / 2);
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, sx, sy, side, side, 0, 0, side, side);
      const { data } = ctx.getImageData(0, 0, side, side);
      const code = jsQR(data, side, side, { inversionAttempts: "dontInvert" });
      if (!code) return;

      const invoice = parseEInvoiceQR(code.data);
      if (invoice) {
        stopEverything();
        onDetect(invoice);
        return;
      }
      // Decoded a QR, but not a Taiwan e-invoice (or a partial read). Keep
      // scanning rather than surfacing an error.
    };

    const start = async () => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setError("insecure");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("no-camera");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        const name = (err as DOMException | undefined)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") setError("denied");
        else if (name === "NotFoundError" || name === "DevicesNotFoundError")
          setError("no-camera");
        else setError("generic");
        return;
      }

      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true; // belt-and-braces: the JSX `muted` prop is unreliable
      try {
        await video.play();
      } catch {
        // Autoplay may reject; muted + playsInline make that rare, and
        // scanFrame tolerates a not-yet-playing video.
      }
      raf = requestAnimationFrame(scanFrame);
    };

    void start();
    return stopEverything;
  }, [onDetect]);

  if (error) return <CameraFallback error={error} />;

  return (
    <Card className="flex flex-col gap-[var(--sp-3)]">
      <div className="relative overflow-hidden rounded-[var(--r-md)] bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={syncGuide}
          className="block w-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[var(--r-sm)] border-2 border-white/70"
          style={{
            left: `${guide.x}%`,
            right: `${guide.x}%`,
            top: `${guide.y}%`,
            bottom: `${guide.y}%`,
          }}
        />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-center text-[length:var(--t-sm)] text-[var(--text-muted)]">
        Point the camera at the left QR code on the receipt.
      </p>
      <Link
        href="/transactions"
        className="self-center text-[length:var(--t-xs)] text-[var(--text-muted)] underline"
      >
        Enter it manually instead
      </Link>
    </Card>
  );
}

function CameraFallback({ error }: { error: CameraError }) {
  const messages: Record<CameraError, { title: string; body: string }> = {
    denied: {
      title: "Camera access blocked",
      body: "Scanning needs camera permission. Enable it for this site in your browser settings and reload, or enter the transaction by hand.",
    },
    "no-camera": {
      title: "No camera available",
      body: "The browser can't reach a camera on this device. Enter the transaction by hand instead.",
    },
    insecure: {
      title: "Scanning needs a secure connection",
      body: "The camera only works over HTTPS (or localhost). Open MoneyLeft at its https:// address, or enter the transaction by hand.",
    },
    generic: {
      title: "Couldn't start the camera",
      body: "Something went wrong opening the camera. Try reloading, or enter the transaction by hand.",
    },
  };
  const message = messages[error];

  return (
    <Card className="flex flex-col items-start gap-[var(--sp-3)]">
      <h2 className="text-[length:var(--t-base)] font-medium text-[var(--text)]">
        {message.title}
      </h2>
      <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">{message.body}</p>
      <Link href="/transactions" className={SECONDARY_LINK}>
        Go to manual entry
      </Link>
    </Card>
  );
}

function ReviewSheet({
  parsed,
  categories,
  action,
  onRescan,
}: {
  parsed: ParsedInvoice;
  categories: string[];
  action: FormAction;
  onRescan: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, {});
  const [category, setCategory] = useState("");

  // addTransaction has no redirect (the manual form stays in place), so it
  // returns an explicit { ok: true } on success. Navigate on that alone.
  useEffect(() => {
    if (state.ok) router.push("/transactions");
  }, [state.ok, router]);

  const isDuplicate = Boolean(state.duplicateTransactionId);
  const suggestion = suggestExistingCategory(category, categories);

  if (isDuplicate) {
    return (
      <Card className="flex flex-col items-start gap-[var(--sp-3)]">
        <h2 className="text-[length:var(--t-base)] font-medium text-[var(--text)]">
          Already scanned
        </h2>
        <p className="text-[length:var(--t-sm)] text-[var(--text-muted)]">
          Invoice {parsed.invoiceNumber} is already saved as a transaction.
        </p>
        <Link
          href={`/transactions/${state.duplicateTransactionId}/edit`}
          className={SECONDARY_LINK}
        >
          View that transaction
        </Link>
        <button
          type="button"
          onClick={onRescan}
          className="text-[length:var(--t-xs)] text-[var(--text-muted)] underline"
        >
          Scan a different receipt
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-[var(--sp-4)]">
        {/* Carried straight from the QR - never shown as editable fields. */}
        <input type="hidden" name="source" value="qr_scan" />
        <input type="hidden" name="type" value="expense" />
        <input type="hidden" name="currency" value="TWD" />
        <input type="hidden" name="einvoice_number" value={parsed.invoiceNumber} />
        <input type="hidden" name="einvoice_date" value={parsed.date} />
        <input type="hidden" name="einvoice_random_code" value={parsed.randomCode} />
        <input type="hidden" name="einvoice_seller_id" value={parsed.sellerId} />

        <div>
          <h2 className="text-[length:var(--t-base)] font-medium text-[var(--text)]">
            Review scanned receipt
          </h2>
          <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
            Invoice {parsed.invoiceNumber} &middot; seller tax ID {parsed.sellerId}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-[var(--sp-3)]">
          <Field label="Amount (total, incl. tax)" htmlFor="scan-amount">
            <Input
              id="scan-amount"
              name="amount"
              type="number"
              step="0.01"
              required
              defaultValue={parsed.totalAmount}
              className="text-[length:var(--t-lg)]"
            />
          </Field>
          <Field label="Currency" htmlFor="scan-currency">
            <Input id="scan-currency" value="TWD" readOnly disabled />
          </Field>
        </div>

        <Field label="Date" htmlFor="scan-date">
          <Input
            id="scan-date"
            name="date"
            type="date"
            required
            defaultValue={parsed.date}
          />
        </Field>

        <Field label="Category" htmlFor="scan-category">
          <Input
            id="scan-category"
            name="category"
            type="text"
            required
            list="scan-categories"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="e.g. Groceries"
            autoComplete="off"
          />
          <datalist id="scan-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {suggestion && (
            <p className="mt-[var(--sp-1)] text-[length:var(--t-xs)] text-[var(--text-muted)]">
              Did you mean{" "}
              <button
                type="button"
                onClick={() => setCategory(suggestion)}
                className="font-medium text-[var(--accent)] underline"
              >
                {suggestion}
              </button>
              ?
            </p>
          )}
        </Field>

        {state.error && (
          <p className="text-[length:var(--t-sm)] text-[var(--neg)]">{state.error}</p>
        )}

        <div className="flex gap-[var(--sp-2)]">
          <Button
            type="submit"
            variant="primary"
            disabled={pending}
            className="disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save transaction"}
          </Button>
          <Button type="button" variant="secondary" onClick={onRescan}>
            Rescan
          </Button>
        </div>
      </form>
    </Card>
  );
}
