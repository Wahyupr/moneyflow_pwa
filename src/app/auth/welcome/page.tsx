"use client";

import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const REDIRECT_DELAY_MS = 1400;

type Stage = "securing" | "ready";

export default function WelcomePage() {
  const [stage, setStage] = useState<Stage>("securing");
  const [progress, setProgress] = useState(8);
  const nextRef = useRef<string>("/dashboard");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const target = params.get("next");
    if (target && target.startsWith("/") && !target.startsWith("//")) {
      nextRef.current = target;
    }

    const startedAt = Date.now();

    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / REDIRECT_DELAY_MS);
      setProgress(Math.round(8 + 88 * easeOutCubic(ratio)));
    }, 60);

    const stageTimer = window.setTimeout(() => setStage("ready"), 650);

    const redirectTimer = window.setTimeout(() => {
      window.location.replace(nextRef.current);
    }, REDIRECT_DELAY_MS + 200);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(stageTimer);
      window.clearTimeout(redirectTimer);
    };
  }, []);

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background px-5 py-10 text-ink">
      <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-primary-container/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-72 rounded-full bg-tertiary/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_0%,rgba(200,255,0,0.06),transparent)]" />

      <section className="relative w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Link href="/" className="transition active:scale-95">
            <img src="/brand-mark.svg" alt="MoneyFlow" className="size-14 rounded-2xl shadow-card" />
          </Link>
        </div>

        <div className="relative mx-auto mb-6 flex size-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" aria-hidden="true" />
          <span className="absolute inset-2 rounded-full bg-primary/10" aria-hidden="true" />
          <div className="relative flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-lift">
            {stage === "securing" ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={34} strokeWidth={2.4} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={34} strokeWidth={2.4} />
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-ink">
          {stage === "securing" ? "Menyambungkan akun…" : "Berhasil masuk"}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted">
          {stage === "securing"
            ? "Kami sedang menyiapkan sesi aman dan membuka dashboard MoneyFlow Anda."
            : "Sesi siap. Anda akan dialihkan ke dashboard sekarang."}
        </p>

        <div className="mx-auto mt-7 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-container">
          <div
            aria-hidden="true"
            className="h-full rounded-full bg-gradient-to-r from-primary to-tertiary transition-[width] duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-muted">
          <ShieldCheck aria-hidden="true" size={14} className="text-primary" />
          <span>Sesi terenkripsi · {progress}%</span>
        </div>
      </section>
    </main>
  );
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
