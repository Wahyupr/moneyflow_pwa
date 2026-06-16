"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Chrome / Edge / Samsung Internet fire `beforeinstallprompt` when the PWA
 * meets installability criteria. We capture it, defer, and let the user
 * trigger the native prompt from our card.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mf:pwa-install-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (mql?.matches ?? false) || iosStandalone;
}

/**
 * iOS Safari never fires `beforeinstallprompt`. Detect Apple devices so we can
 * fall back to manual "Add to Home Screen" instructions instead of a dead
 * Install button. iPadOS 13+ reports as Macintosh but supports touch.
 */
function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return true;
  return false;
}

function getDismissedAt(): number {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem(DISMISS_KEY) ?? 0);
}

function persistDismissedAt() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

export function InstallPromptCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissedAt, setDismissedAtState] = useState(0);
  const [prompting, setPrompting] = useState(false);
  // iOS is a stable per-device property; compute once.
  const [ios] = useState(detectIOS);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setDismissedAtState(getDismissedAt());

    const onBefore = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const recentlyDismissed = Date.now() - dismissedAt < DISMISS_TTL_MS;
  // Chromium shows when we have a captured event.
  // iOS shows when on an Apple device (no event ever fires).
  // Other browsers (Firefox desktop, etc.) never show.
  const visible = !installed && !recentlyDismissed && (Boolean(deferred) || ios);

  async function handleInstall() {
    if (!deferred) return;
    setPrompting(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "dismissed") {
        persistDismissedAt();
        setDismissedAtState(Date.now());
      }
    } finally {
      setDeferred(null);
      setPrompting(false);
    }
  }

  function handleDismiss() {
    persistDismissedAt();
    setDismissedAtState(Date.now());
  }

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/60 bg-white/85 p-4 shadow-card backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {ios ? <Smartphone size={18} /> : <Download size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">Pasang MoneyFlow</p>
          <p className="text-xs text-muted">Akses lebih cepat dari home screen.</p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-container active:scale-95"
          aria-label="Tutup"
        >
          <X size={14} />
        </button>
      </div>

      {ios ? (
        <ol className="relative mt-3 space-y-2 text-xs text-ink">
          <li className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-container text-[10px] font-bold text-primary">1</span>
            <span>
              Tap ikon <strong>Share</strong> di Safari.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-container text-[10px] font-bold text-primary">2</span>
            <span>
              Pilih <strong>Add to Home Screen</strong>.
            </span>
          </li>
        </ol>
      ) : (
        <button
          type="button"
          onClick={handleInstall}
          disabled={prompting}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-60"
        >
          <Download size={16} />
          {prompting ? "Memproses..." : "Install Sekarang"}
        </button>
      )}
    </div>
  );
}
