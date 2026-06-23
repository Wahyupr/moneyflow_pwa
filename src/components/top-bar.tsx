"use client";

import Link from "next/link";
import { Bell, Download, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { isRunningStandalone } from "@/lib/onboarding";

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

export function TopBar({ title = "MoneyFlow", subtitle }: { title?: string; subtitle?: string }) {
  const unread = useUnreadCount();
  const { show: showInstall, install, installing } = useInstallButton();

  return (
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
  );
}
