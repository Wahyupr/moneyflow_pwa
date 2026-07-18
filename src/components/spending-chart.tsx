"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/money";
import type { LedgerTransaction } from "@/lib/types";

type DayBucket = { day: number; income: number; expense: number };
type ChartType = "line" | "bar";

function buildDailyBuckets(transactions: LedgerTransaction[], month: string): DayBucket[] {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const buckets: DayBucket[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    income: 0,
    expense: 0,
  }));
  for (const tx of transactions) {
    if (tx.transfer_pair_id) continue;
    const d = new Date(tx.occurred_at);
    if (d.getFullYear() !== y || d.getMonth() + 1 !== m) continue;
    const idx = d.getDate() - 1;
    if (tx.transaction_type === "income") buckets[idx].income += Math.abs(tx.amount_minor);
    else if (tx.transaction_type === "expense") buckets[idx].expense += Math.abs(tx.amount_minor);
  }
  return buckets;
}

const W = 560;
const H = 180;
const PAD = { top: 20, right: 16, bottom: 32, left: 16 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx.toFixed(1)} ${y0.toFixed(1)}, ${cpx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

function buildCurvePath(buckets: DayBucket[], key: "income" | "expense", maxVal: number): string {
  const pts: [number, number][] = buckets.map((b, i) => [
    PAD.left + (i / Math.max(buckets.length - 1, 1)) * innerW,
    PAD.top + innerH - (b[key] / maxVal) * innerH,
  ]);
  return smoothPath(pts);
}

function buildAreaPath(buckets: DayBucket[], key: "income" | "expense", maxVal: number): string {
  if (buckets.length === 0) return "";
  const baseline = PAD.top + innerH;
  const pts: [number, number][] = buckets.map((b, i) => [
    PAD.left + (i / Math.max(buckets.length - 1, 1)) * innerW,
    PAD.top + innerH - (b[key] / maxVal) * innerH,
  ]);
  const curvePart = smoothPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${curvePart} L ${last[0].toFixed(1)} ${baseline} L ${first[0].toFixed(1)} ${baseline} Z`;
}

function shouldShowLabel(day: number): boolean {
  return day === 1 || day % 5 === 0;
}

const BAR_GAP = 1;

function BarChart({ buckets, maxVal }: { buckets: DayBucket[]; maxVal: number }) {
  const n = buckets.length;
  const slotW = innerW / n;
  const barW = Math.max((slotW - BAR_GAP * 3) / 2, 1);

  return (
    <>
      {buckets.map((b, i) => {
        const slotX = PAD.left + i * slotW;
        const incomeH = (b.income / maxVal) * innerH;
        const expenseH = (b.expense / maxVal) * innerH;
        const baseline = PAD.top + innerH;
        return (
          <g key={b.day}>
            <rect
              x={slotX + BAR_GAP}
              y={baseline - incomeH}
              width={barW}
              height={incomeH}
              fill="#10B981"
              fillOpacity={0.8}
              rx={1}
            />
            <rect
              x={slotX + BAR_GAP * 2 + barW}
              y={baseline - expenseH}
              width={barW}
              height={expenseH}
              fill="#EF4444"
              fillOpacity={0.8}
              rx={1}
            />
          </g>
        );
      })}
    </>
  );
}

function LineChart({
  incomePath,
  expensePath,
  incomeArea,
  expenseArea,
}: {
  incomePath: string;
  expensePath: string;
  incomeArea: string;
  expenseArea: string;
}) {
  return (
    <>
      <defs>
        <linearGradient id="grad-income" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-expense" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={incomeArea} fill="url(#grad-income)" />
      <path d={expenseArea} fill="url(#grad-expense)" />
      <path d={incomePath} fill="none" stroke="#10B981" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <path d={expensePath} fill="none" stroke="#EF4444" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

export function SpendingChart({
  transactions,
  month,
  hidden,
}: {
  transactions: LedgerTransaction[];
  month: string;
  hidden: boolean;
}) {
  const [chartType, setChartType] = useState<ChartType>("line");

  const buckets = useMemo(() => buildDailyBuckets(transactions, month), [transactions, month]);
  const maxVal = Math.max(...buckets.flatMap((b) => [b.income, b.expense]), 1);

  const incomePath = useMemo(() => buildCurvePath(buckets, "income", maxVal), [buckets, maxVal]);
  const expensePath = useMemo(() => buildCurvePath(buckets, "expense", maxVal), [buckets, maxVal]);
  const incomeArea = useMemo(() => buildAreaPath(buckets, "income", maxVal), [buckets, maxVal]);
  const expenseArea = useMemo(() => buildAreaPath(buckets, "expense", maxVal), [buckets, maxVal]);

  const totalIncome = useMemo(() => buckets.reduce((s, b) => s + b.income, 0), [buckets]);
  const totalExpense = useMemo(() => buckets.reduce((s, b) => s + b.expense, 0), [buckets]);

  return (
    <section className="mt-5 rounded-xl bg-surface p-4 shadow-card">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">Arus Kas Harian</h2>
        <div className="flex items-center gap-3">
          {/* Toggle diagram */}
          <div className="flex items-center rounded-lg bg-surface-container p-0.5">
            <button
              onClick={() => setChartType("line")}
              aria-pressed={chartType === "line"}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                chartType === "line"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Garis
            </button>
            <button
              onClick={() => setChartType("bar")}
              aria-pressed={chartType === "bar"}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                chartType === "bar"
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Batang
            </button>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full bg-income" />
              Pemasukan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full bg-expense" />
              Pengeluaran
            </span>
          </div>
        </div>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        aria-label={`Grafik arus kas harian - diagram ${chartType === "line" ? "garis" : "batang"}`}
        role="img"
      >
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={PAD.left}
            x2={PAD.left + innerW}
            y1={PAD.top + innerH * frac}
            y2={PAD.top + innerH * frac}
            stroke="#888"
            strokeOpacity={0.08}
            strokeWidth={1}
          />
        ))}

        {chartType === "line" ? (
          <LineChart
            incomePath={incomePath}
            expensePath={expensePath}
            incomeArea={incomeArea}
            expenseArea={expenseArea}
          />
        ) : (
          <BarChart buckets={buckets} maxVal={maxVal} />
        )}

        {/* X-axis labels */}
        {buckets.map((b, i) => {
          if (!shouldShowLabel(b.day)) return null;
          const x = PAD.left + (i / Math.max(buckets.length - 1, 1)) * innerW;
          return (
            <text
              key={b.day}
              x={x}
              y={PAD.top + innerH + 18}
              textAnchor="middle"
              fontSize={10}
              fill="#888"
              fillOpacity={0.7}
            >
              {b.day}
            </text>
          );
        })}
      </svg>

      {/* Summary row */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-container px-3 py-2 text-xs">
          <p className="mb-0.5 font-bold text-muted">Total Pemasukan</p>
          <p className="text-income">+{hidden ? "***" : formatCurrency(totalIncome, "IDR")}</p>
        </div>
        <div className="rounded-lg bg-surface-container px-3 py-2 text-xs">
          <p className="mb-0.5 font-bold text-muted">Total Pengeluaran</p>
          <p className="text-expense">-{hidden ? "***" : formatCurrency(totalExpense, "IDR")}</p>
        </div>
      </div>
    </section>
  );
}