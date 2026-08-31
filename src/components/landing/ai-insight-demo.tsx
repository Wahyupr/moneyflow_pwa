"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, TrendingDown, TrendingUp, Lightbulb } from "lucide-react";

/**
 * Animated AI-insight mockup for the landing page. Simulates the real daily
 * insight: streams a short "analysis" line-by-line, then reveals a saran card.
 * Starts only when scrolled into view (IntersectionObserver) so it feels alive
 * at the right moment and respects reduced-motion via the global CSS rule.
 */

const INSIGHT_LINES = [
  "Pengeluaran makan & minum naik 18% minggu ini.",
  "Kategori transport justru turun 9% — bagus.",
  "Kamu masih aman di 62% dari budget bulanan."
] as const;

const SARAN =
  "Saran: sisihkan Rp150.000 dari sisa budget transport ke tabungan. Kurangi jajan kopi 2x/minggu untuk hemat ~Rp56.000.";

export function AiInsightDemo() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [started, setStarted] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);
  const [showSaran, setShowSaran] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setStarted(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    INSIGHT_LINES.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleLines(i + 1), 500 + i * 900));
    });
    timers.push(setTimeout(() => setShowSaran(true), 500 + INSIGHT_LINES.length * 900 + 300));
    return () => timers.forEach(clearTimeout);
  }, [started]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md">
      {/* Rotating glow behind the card */}
      <div
        aria-hidden
        className="lp-orb-spin absolute -inset-6 -z-10 rounded-[2.5rem] bg-[conic-gradient(from_0deg,theme(colors.primary/25),theme(colors.income/20),theme(colors.secondary/25),theme(colors.primary/25))] blur-2xl"
      />
      <div className="rounded-[2rem] border border-outline bg-surface/90 p-5 shadow-lift backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-ink">
            <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white">
              <Sparkles size={15} />
            </span>
            Insight Harian AI
          </span>
          <span className="rounded-full bg-income/15 px-2 py-1 text-[11px] font-bold text-income">Live</span>
        </div>

        {/* Streamed analysis lines */}
        <div className="mt-4 space-y-2">
          {INSIGHT_LINES.map((line, i) => {
            const shown = i < visibleLines;
            const isLast = i === visibleLines - 1;
            const Icon = i === 0 ? TrendingUp : i === 1 ? TrendingDown : Lightbulb;
            const tone = i === 0 ? "text-expense" : i === 1 ? "text-income" : "text-primary";
            return (
              <div
                key={line}
                className="lp-type-line flex items-start gap-2 rounded-xl bg-surface-low px-3 py-2 text-sm text-ink"
                style={{ animationDelay: `${i * 0.05}s`, opacity: shown ? undefined : 0 }}
              >
                {shown ? (
                  <>
                    <Icon size={15} className={`mt-0.5 shrink-0 ${tone}`} />
                    <span className="leading-snug">
                      {line}
                      {isLast && !showSaran ? <span className="lp-caret ml-0.5" /> : null}
                    </span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Saran card */}
        {showSaran ? (
          <div className="lp-type-line mt-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-secondary/10 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
              <Lightbulb size={13} /> Rekomendasi
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{SARAN}</p>
          </div>
        ) : (
          <div className="mt-3 h-[4.5rem] rounded-xl border border-dashed border-outline/60" />
        )}
      </div>
    </div>
  );
}
