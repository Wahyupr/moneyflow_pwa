"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small animated bar chart used inside the AI-insight section. Bars grow from
 * the baseline once scrolled into view. Purely decorative — aria-hidden.
 */

type Bar = { label: string; value: number; tone: string };

const BARS: Bar[] = [
  { label: "Sen", value: 42, tone: "bg-primary/70" },
  { label: "Sel", value: 68, tone: "bg-primary/70" },
  { label: "Rab", value: 55, tone: "bg-primary/70" },
  { label: "Kam", value: 88, tone: "bg-expense/70" },
  { label: "Jum", value: 73, tone: "bg-primary/70" },
  { label: "Sab", value: 96, tone: "bg-expense/80" },
  { label: "Min", value: 50, tone: "bg-income/70" }
];

export function SpendChart() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShow(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="flex h-40 items-end justify-between gap-2 rounded-2xl border border-outline bg-surface-low/60 p-4"
    >
      {BARS.map((bar, i) => (
        <div key={bar.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-full w-full items-end justify-center">
            <div
              className={`lp-bar w-full max-w-6 rounded-t-md ${bar.tone}`}
              style={{
                height: show ? `${bar.value}%` : "0%",
                animationDelay: `${i * 90}ms`
              }}
            />
          </div>
          <span className="text-[10px] font-semibold text-muted">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}
