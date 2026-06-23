"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { detectBrowser, isRunningStandalone, type BrowserType } from "@/lib/onboarding";

const DISMISSED_KEY = "pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTRUCTIONS: Record<BrowserType, { steps: string[] }> = {
  "safari-ios": {
    steps: [
      "Ketuk tombol Share (kotak dengan panah ke atas) di bawah browser",
      'Gulir ke bawah dan pilih "Tambahkan ke Layar Utama"',
      'Ketuk "Tambahkan" di pojok kanan atas'
    ]
  },
  "chrome-android": {
    steps: [
      "Ketuk menu titik tiga (⋮) di pojok kanan atas",
      'Pilih "Tambahkan ke layar utama" atau "Pasang aplikasi"',
      "Konfirmasi dengan ketuk Pasang"
    ]
  },
  edge: {
    steps: [
      "Ketuk menu titik tiga (…) di bawah browser",
      'Pilih "Aplikasi"',
      '"Pasang situs ini sebagai aplikasi"'
    ]
  },
  samsung: {
    steps: [
      "Ketuk ikon menu di bagian bawah browser",
      '"Tambahkan halaman ke"',
      '"Layar Utama"'
    ]
  },
  firefox: {
    steps: [
      "Ketuk menu titik tiga (⋮)",
      '"Pasang"',
      "Konfirmasi pemasangan"
    ]
  },
  other: {
    steps: [
      "Buka menu browser",
      '"Pasang Aplikasi" atau "Tambahkan ke Layar Utama"',
      "Konfirmasi"
    ]
  }
};

/**
 * Shows a smart PWA install banner:
 * - Uses the native beforeinstallprompt event on Chrome/Edge Android
 * - Falls back to manual instructions for iOS Safari & other browsers
 * - Never shows when already running as standalone (installed)
 */
export function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>("other");
  const [nativePrompt, setNativePrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Already installed or user dismissed previously
    if (isRunningStandalone()) return;
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // ignore
    }

    const detected = detectBrowser();
    setBrowser(detected);

    // Chrome/Edge Android: listen for the native install event
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setNativePrompt(event as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);

    // For iOS Safari & other browsers, show manual instructions after a short delay
    if (detected !== "chrome-android" && detected !== "edge") {
      const t = window.setTimeout(() => setShow(true), 3000);
      return () => {
        window.removeEventListener("beforeinstallprompt", handlePrompt);
        clearTimeout(t);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
    };
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!nativePrompt) return;
    setInstalling(true);
    try {
      await nativePrompt.prompt();
      const { outcome } = await nativePrompt.userChoice;
      if (outcome === "accepted") {
        dismiss();
      }
    } finally {
      setInstalling(false);
    }
  }

  if (!show) return null;

  const instructions = INSTRUCTIONS[browser];
  const canNativeInstall = nativePrompt !== null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pasang MoneyFlow"
      className="fixed inset-x-0 bottom-16 z-[80] px-4 pb-2 md:bottom-4"
    >
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-outline bg-surface shadow-lift">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-primary to-primary-container px-4 py-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/brand-mark.svg" alt="MoneyFlow" className="size-9 rounded-xl" />
            <div>
              <p className="font-bold text-white">Pasang MoneyFlow</p>
              <p className="text-xs text-white/75">Akses cepat langsung dari Home Screen</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            type="button"
            aria-label="Tutup"
            className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {canNativeInstall ? (
            <button
              onClick={install}
              disabled={installing}
              type="button"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-white shadow-card transition active:scale-[0.98] disabled:opacity-60"
            >
              {installing ? "Memasang..." : "Pasang Sekarang"}
            </button>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold text-muted">
                {browser === "safari-ios" ? "Cara pasang di Safari iOS:" : "Cara pasang aplikasi ini:"}
              </p>
              <ol className="space-y-2">
                {instructions.steps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="leading-5 text-ink">{step}</span>
                  </li>
                ))}
              </ol>
              <button
                onClick={dismiss}
                type="button"
                className="mt-4 min-h-10 w-full rounded-xl border border-outline bg-surface-low text-sm font-semibold text-muted active:scale-[0.98]"
              >
                Nanti saja
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
