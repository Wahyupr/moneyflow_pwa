"use client";

import Link from "next/link";
import { Bell, Download, Moon, Share, Sun, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { detectBrowser, isRunningStandalone } from "@/lib/onboarding";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications/logs")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (json) setCount(json.unread ?? 0); })
      .catch(() => undefined);
  }, []);

  return count;
}

function useInstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true); // assume installed until checked
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isRunningStandalone()) return; // already installed
    setInstalled(false);

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
    } finally {
      setInstalling(false);
    }
  }

  // Only show if: not installed AND native prompt is available
  const show = !installed && prompt !== null;
  return { show, install, installing };
}

function useIosInstallButton() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isRunningStandalone()) return;
    if (detectBrowser() === "safari-ios") setShow(true);
  }, []);

  return { show, open, setOpen };
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="size-10" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-card transition active:scale-95"
      aria-label={isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function TopBar({ title = "MoneyFlow", subtitle }: { title?: string; subtitle?: string }) {
  const unread = useUnreadCount();
  const { show: showInstall, install, installing } = useInstallButton();
  const { show: showIos, open: iosOpen, setOpen: setIosOpen } = useIosInstallButton();

  return (
    <>
      <header className="sticky top-0 z-50 -mx-5 flex min-h-16 items-center justify-between bg-background/95 px-5 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
        <Link
          className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary shadow-card active:scale-95 md:hidden"
          href="/settings"
          aria-label="Buka pengaturan"
        >
          <UserRound size={20} />
        </Link>
        <div className="min-w-0 flex-1 px-3 md:px-0">
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
          <h1 className="truncate text-xl font-bold text-primary">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {showInstall ? (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              aria-label="Pasang MoneyFlow ke Home Screen"
              title="Pasang MoneyFlow"
              className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-white shadow-card transition active:scale-95 disabled:opacity-60"
            >
              <Download size={14} aria-hidden="true" />
              <span className="hidden sm:inline">{installing ? "Memasang..." : "Pasang"}</span>
            </button>
          ) : null}
          {showIos && !showInstall ? (
            <button
              type="button"
              onClick={() => setIosOpen(true)}
              aria-label="Cara pasang MoneyFlow di iPhone"
              title="Pasang MoneyFlow"
              className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-white shadow-card transition active:scale-95"
            >
              <Share size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Pasang</span>
            </button>
          ) : null}
          <ThemeToggle />
          <Link
            aria-label={unread > 0 ? `Notifikasi (${unread} belum dibaca)` : "Notifikasi"}
            className="relative flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-card active:scale-95"
            href="/notifications"
          >
            <Bell size={19} />
            {unread > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-expense text-[9px] font-black text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>
          <Link
            className="hidden size-10 items-center justify-center rounded-full bg-surface-container text-primary shadow-card active:scale-95 md:flex"
            href="/settings"
            aria-label="Buka pengaturan"
          >
            <UserRound size={20} />
          </Link>
        </div>
      </header>

      {/* iOS install instructions modal */}
      {iosOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 px-4 pb-4"
          onClick={() => setIosOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-primary to-primary-container px-4 py-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/brand-mark.svg" alt="MoneyFlow" className="size-9 rounded-xl" />
                <div>
                  <p className="font-bold text-white">Pasang MoneyFlow</p>
                  <p className="text-xs text-white/75">Akses cepat dari Home Screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIosOpen(false)}
                aria-label="Tutup"
                className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white active:scale-95"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              <p className="mb-3 text-sm font-semibold text-muted">Cara pasang di Safari iOS:</p>
              <ol className="space-y-3">
                {[
                  "Ketuk tombol Share (□↑) di bawah browser Safari",
                  'Gulir ke bawah dan pilih "Tambahkan ke Layar Utama"',
                  'Ketuk "Tambahkan" di pojok kanan atas'
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="leading-5 text-ink">{step}</span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => setIosOpen(false)}
                className="mt-4 min-h-10 w-full rounded-xl border border-outline bg-surface-low text-sm font-semibold text-muted active:scale-[0.98]"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
