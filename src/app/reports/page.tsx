"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Store,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart2,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { formatCurrency } from "@/lib/money";

type CategoryRow = { category_id: string | null; category_name: string; category_color: string; expense_minor: number };
type MerchantRow = { name: string; expense_minor: number; logo_url?: string | null };
type TrendRow = { month: string; income_minor: number; expense_minor: number };

type ReportData = {
  month: string;
  totals: { income_minor: number; expense_minor: number; net_minor: number };
  by_category: CategoryRow[];
  top_merchants: MerchantRow[];
  trend: TrendRow[];
};

type PeriodMode = "month" | "custom";

function monthLabel(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function monthLabelShort(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

function prevMonth(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function nextMonth(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

export default function ReportsPage() {
  return (
    <AppFrame title="Laporan" subtitle="Analytics">
      <ReportsContent />
    </AppFrame>
  );
}

function ReportsContent() {
  const { displayAmount } = usePrivacy();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async (params: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/summary?${params}`);
      if (!response.ok) { setError("Gagal memuat laporan."); return; }
      setData(await response.json());
    } catch {
      setError("Gagal memuat laporan.");
    } finally {
      setLoading(false);
    }
  }, []);

  function buildExportParams(): string | null {
    if (mode === "month") return `month=${month}`;
    if (customFrom && customTo && customFrom <= customTo) return `from=${customFrom}&to=${customTo}`;
    return null;
  }

  async function exportExcel() {
    const params = buildExportParams();
    if (!params) return;
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch(`/api/reports/export?${params}`);
      if (!response.ok) {
        const errJson = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errJson?.error ?? "Gagal mengekspor laporan.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
      const fallbackMatch = /filename="([^"]+)"/i.exec(disposition);
      a.download = match ? decodeURIComponent(match[1]) : fallbackMatch ? fallbackMatch[1] : "laporan-keuangan.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Gagal mengekspor laporan.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (mode === "month") {
      void load(`month=${month}`);
    } else if (customFrom && customTo) {
      void load(`from=${customFrom}&to=${customTo}`);
    }
  }, [load, mode, month, customFrom, customTo]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const canGoNext = month < thisMonth;

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) setMode("custom");
  }

  return (
    <div className="mt-4 space-y-4 pb-6">

      {/* ── Period selector ── */}
      <div className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("month")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
              mode === "month"
                ? "bg-primary text-white shadow-sm"
                : "bg-surface-container text-muted"
            }`}
          >
            Per Bulan
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
              mode === "custom"
                ? "bg-primary text-white shadow-sm"
                : "bg-surface-container text-muted"
            }`}
          >
            Custom
          </button>
        </div>

        {mode === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[120px]">
              <span className="text-xs font-semibold text-muted">Dari</span>
              <input
                type="date"
                className="mt-1 min-h-10 w-full rounded-xl border border-outline bg-background px-3 text-sm focus:border-primary focus:outline-none"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="flex-1 min-w-[120px]">
              <span className="text-xs font-semibold text-muted">Sampai</span>
              <input
                type="date"
                className="mt-1 min-h-10 w-full rounded-xl border border-outline bg-background px-3 text-sm focus:border-primary focus:outline-none"
                value={customTo}
                min={customFrom || undefined}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="min-h-10 rounded-xl bg-primary px-5 text-sm font-bold text-white disabled:opacity-50"
              disabled={!customFrom || !customTo || customFrom > customTo}
              onClick={applyCustom}
            >
              Lihat
            </button>
          </div>
        )}
      </div>

      {/* ── Month navigation ── */}
      {mode === "month" ? (
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full bg-surface shadow-card active:scale-95 transition-transform"
            onClick={() => setMonth(prevMonth(month))}
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-base font-bold capitalize">{monthLabel(month)}</span>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-full bg-surface shadow-card active:scale-95 transition-transform disabled:opacity-30"
            onClick={() => setMonth(nextMonth(month))}
            disabled={!canGoNext}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-muted">
          {customFrom} — {customTo}
        </p>
      )}

      {/* ── Loading / Error / Data ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="rounded-2xl bg-surface p-6 text-center shadow-card">
          <p className="text-sm font-semibold text-expense">{error}</p>
          <button
            type="button"
            className="mt-3 min-h-10 rounded-xl bg-primary/10 px-5 text-sm font-bold text-primary"
            onClick={() => void load(mode === "month" ? `month=${month}` : `from=${customFrom}&to=${customTo}`)}
          >
            Coba lagi
          </button>
        </div>
      ) : data ? (
        <>
          {/* ── Hero summary card ── */}
          <section className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-white shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Saldo Bersih</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">
              {displayAmount(formatCurrency(data.totals.net_minor, "IDR"))}
            </p>
            <div className="mt-4 flex gap-4">
              <div className="flex-1 rounded-xl bg-white/15 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
                  <ArrowUpRight size={14} />
                  Pemasukan
                </div>
                <p className="mt-1 text-sm font-bold tabular-nums">
                  {displayAmount(formatCurrency(data.totals.income_minor, "IDR"))}
                </p>
              </div>
              <div className="flex-1 rounded-xl bg-white/15 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
                  <ArrowDownRight size={14} />
                  Pengeluaran
                </div>
                <p className="mt-1 text-sm font-bold tabular-nums">
                  {displayAmount(formatCurrency(data.totals.expense_minor, "IDR"))}
                </p>
              </div>
            </div>
            {/* net status badge */}
            <div className="mt-3 flex items-center gap-1.5">
              {data.totals.net_minor > 0 ? (
                <><TrendingUp size={14} className="opacity-80" /><span className="text-xs font-semibold opacity-80">Surplus bulan ini</span></>
              ) : data.totals.net_minor < 0 ? (
                <><TrendingDown size={14} className="opacity-80" /><span className="text-xs font-semibold opacity-80">Defisit bulan ini</span></>
              ) : (
                <><Minus size={14} className="opacity-80" /><span className="text-xs font-semibold opacity-80">Impas bulan ini</span></>
              )}
            </div>
          </section>

          {/* ── Category breakdown ── */}
          {data.by_category.length > 0 && (
            <section className="rounded-2xl bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BarChart2 size={16} />
                </div>
                <h2 className="text-base font-bold text-ink">Pengeluaran per Kategori</h2>
              </div>
              <div className="space-y-3.5">
                {data.by_category.map((row, i) => {
                  const pct = data.totals.expense_minor > 0
                    ? Math.min(100, Math.round((row.expense_minor / data.totals.expense_minor) * 100))
                    : 0;
                  return (
                    <div key={row.category_id ?? "uncategorized"}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                            style={{ backgroundColor: row.category_color }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold text-ink">{row.category_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className="text-xs font-bold text-muted">{pct}%</span>
                          <span className="text-sm font-bold text-ink tabular-nums">
                            {displayAmount(formatCurrency(row.expense_minor, "IDR"))}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: row.category_color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Top merchants ── */}
          {data.top_merchants.length > 0 && (
            <section className="rounded-2xl bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <Store size={16} />
                </div>
                <h2 className="text-base font-bold text-ink">Top Merchant</h2>
              </div>
              <div className="space-y-2">
                {data.top_merchants.map((merchant, index) => {
                  const maxExpense = data.top_merchants[0]?.expense_minor ?? 1;
                  const pct = Math.round((merchant.expense_minor / maxExpense) * 100);
                  const medals = ["🥇", "🥈", "🥉"];
                  return (
                    <div key={merchant.name} className="relative overflow-hidden rounded-xl bg-surface-container p-3">
                      {/* bar background */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-xl bg-amber-500/10 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center gap-3">
                        {merchant.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={merchant.name} className="size-9 shrink-0 rounded-full object-cover" src={merchant.logo_url} />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-sm">
                            <Store size={15} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span>{medals[index] ?? `#${index + 1}`}</span>
                            <p className="truncate text-sm font-bold text-ink">{merchant.name}</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-extrabold text-expense tabular-nums">
                          {displayAmount(formatCurrency(merchant.expense_minor, "IDR"))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Trend chart ── */}
          {data.trend.length > 0 && (
            <section className="rounded-2xl bg-surface p-5 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <TrendingUp size={16} />
                </div>
                <h2 className="text-base font-bold text-ink">Tren 6 Bulan</h2>
              </div>
              <div className="mb-3 flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-income">
                  <span className="inline-block h-2 w-3 rounded-sm bg-income/70" />
                  Pemasukan
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-expense">
                  <span className="inline-block h-2 w-3 rounded-sm bg-expense/70" />
                  Pengeluaran
                </span>
              </div>
              <TrendChart trend={data.trend} displayAmount={displayAmount} />
            </section>
          )}

          {/* ── Export card ── */}
          <section className="rounded-2xl bg-surface p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <FileSpreadsheet size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-ink">Export ke Excel</h2>
                <p className="mt-0.5 text-xs text-muted">Workbook 6 sheet berwarna + Analisis AI.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <SheetChip color="bg-orange-500" label="Ringkasan" />
                  <SheetChip color="bg-blue-500" label="Kategori" />
                  <SheetChip color="bg-purple-500" label="Merchant" />
                  <SheetChip color="bg-emerald-500" label="Tren" />
                  <SheetChip color="bg-slate-500" label="Transaksi" />
                  <SheetChip color="bg-amber-500" label="AI Insight" />
                </div>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                  disabled={exporting || loading}
                  onClick={() => void exportExcel()}
                >
                  <Download size={16} className={exporting ? "animate-bounce" : ""} />
                  {exporting ? "Menyiapkan Excel + AI..." : "Download .xlsx"}
                </button>
                {exportError && (
                  <p className="mt-2 text-xs font-semibold text-expense">{exportError}</p>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

/* ── Trend chart ── */
function TrendChart({ trend, displayAmount }: { trend: TrendRow[]; displayAmount: (v: string) => string }) {
  const max = Math.max(...trend.flatMap((r) => [r.income_minor, r.expense_minor]), 1);
  const BAR_MAX_PX = 80;

  return (
    <div className="flex items-end justify-between gap-1">
      {trend.map((row) => {
        const incomeH = Math.max(4, Math.round((row.income_minor / max) * BAR_MAX_PX));
        const expenseH = Math.max(4, Math.round((row.expense_minor / max) * BAR_MAX_PX));
        return (
          <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full text-center text-[8px] font-bold text-income tabular-nums leading-none"
              title={displayAmount(formatCurrency(row.income_minor, "IDR"))}
            />
            <div className="flex w-full items-end justify-center gap-[2px]">
              <div
                className="flex-1 rounded-t-sm bg-income/70 transition-all duration-500"
                style={{ height: `${incomeH}px` }}
                title={`Pemasukan ${row.month}`}
              />
              <div
                className="flex-1 rounded-t-sm bg-expense/70 transition-all duration-500"
                style={{ height: `${expenseH}px` }}
                title={`Pengeluaran ${row.month}`}
              />
            </div>
            <span className="w-full truncate text-center text-[9px] font-semibold text-muted">
              {monthLabelShort(row.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Skeleton loader ── */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-36 rounded-2xl bg-surface-container" />
      <div className="h-48 rounded-2xl bg-surface-container" />
      <div className="h-40 rounded-2xl bg-surface-container" />
    </div>
  );
}

/* ── Sub-components ── */
function SheetChip({ color, label }: { color: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${color}`}>
      <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-white/70" />
      {label}
    </span>
  );
}
