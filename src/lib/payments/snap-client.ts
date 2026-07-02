"use client";

// Client-side helper to load Midtrans Snap.js and open the payment popup.
// Shared between the pricing page and the payment-history "resume payment" flow
// so the script-loading logic lives in one place.

type SnapResult = {
  order_id?: string;
  transaction_status?: string;
  [key: string]: unknown;
};

type SnapHandlers = {
  onSuccess?: (result: SnapResult) => void;
  onPending?: (result: SnapResult) => void;
  onError?: (result: SnapResult) => void;
  onClose?: () => void;
};

type SnapGlobal = {
  pay: (token: string, opts: SnapHandlers) => void;
};

function getSnap(): SnapGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { snap?: SnapGlobal }).snap;
}

/**
 * Ensures the Midtrans Snap script is present. Resolves once `window.snap`
 * is available. Rejects if the script fails to load.
 */
export function loadSnapScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (getSnap()) {
      resolve();
      return;
    }

    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "";
    const env = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true" ? "app" : "app.sandbox";

    // Reuse an in-flight script tag if one already exists.
    const existing = document.querySelector<HTMLScriptElement>("script[data-snap='true']");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Snap JS")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://${env}.midtrans.com/snap/snap.js`;
    script.setAttribute("data-client-key", clientKey);
    script.setAttribute("data-snap", "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Snap JS"));
    document.head.appendChild(script);
  });
}

/**
 * Opens the Snap popup for a given token. Loads the script first if needed.
 * If the popup cannot be opened (blocked / snap missing) and a redirectUrl is
 * provided, falls back to a full-page redirect.
 */
export async function openSnap(
  token: string,
  handlers: SnapHandlers,
  redirectUrl?: string
): Promise<void> {
  await loadSnapScript();
  const snap = getSnap();

  if (snap?.pay) {
    snap.pay(token, handlers);
    return;
  }

  if (redirectUrl) {
    window.location.href = redirectUrl;
    return;
  }

  throw new Error("Snap tidak tersedia.");
}

export type { SnapResult, SnapHandlers };
