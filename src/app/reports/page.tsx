"use client";

import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Store } from "lucide-react";

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
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
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
      if (!response.ok) {
        setError("Gagal memuat laporan.");
        return;
      }
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
      // Pull filename from Content-Disposition if present, else fallback.
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
    if (customFrom && customTo && customFrom <= customTo) {
      setMode("custom");
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {/* Period selector: month nav + custom range */}
      <div className="rounded-xl bg-surface p-4 shadow-card">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`min-h-9 rounded-full border px-4 text-sm font-semibold ${mode === "month" ? "border-primary bg-primary text-white" : "border-outline text-muted"}`}
            onClick={() => setMode("month")}
          >
            Per Bulan
          </button>
          <button
            type="button"
            className={`min-h-9 rounded-full border px-4 text-sm font-semibold ${mode === "custom" ? "border-primary bg-primary text-white" : "border-outline text-muted"}`}
            onClick={() => setMode("custom")}
          >
            Custom
          </button>
        </div>

        {mode === "custom" ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex-1">
              <span className="text-xs font-semibold text-muted">Dari</span>
              <input type="date" className="mt-1 min-h-10 w-full rounded-lg border border-outline bg-background px-3 text-sm focus:border-primary focus:outline-none" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label className="flex-1">
              <span className="text-xs font-semibold text-muted">Sampai</span>
              <input type="date" className="mt-1 min-h-10 w-full rounded-lg border border-outline bg-background px-3 text-sm focus:border-primary focus:outline-none" value={customTo} min={customFrom || undefined} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
            <button type="button" className="min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-60" disabled={!customFrom || !customTo || customFrom > customTo} onClick={applyCustom}>Lihat</button>
          </div>
        ) : null}
      </div>

      {mode === "month" ? (
        <div className="flex items-center justify-between">
          <button className="flex size-10 items-center justify-center rounded-full bg-surface shadow-card active:scale-95" onClick={() => setMonth(prevMonth(month))} type="button">
            <ChevronLeft size={20} />
          </button>
          <span className="text-lg font-bold capitalize">{monthLabel(month)}</span>
          <button className="flex size-10 items-center justify-center rounded-full bg-surface shadow-card active:scale-95 disabled:opacity-40" onClick={() => setMonth(nextMonth(month))} type="button" disabled={!canGoNext}>
            <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        <p className="text-center text-sm font-semibold text-muted">
          {customFrom} — {customTo}
        </p>
      )}

      <section className="rounded-xl bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-ink">Export Laporan ke Excel</h2>
            <p className="mt-1 text-xs text-muted">
              Workbook 6 sheet berwarna + Analisis AI detail di sheet terakhir.
            </p>
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
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-50"
              disabled={exporting || loading}
              onClick={() => void exportExcel()}
            >
              <Download size={16} className={exporting ? "animate-bounce" : ""} />
              {exporting ? "Menyiapkan Excel + Analisis AI..." : "Download .xlsx"}
            </button>
            {exportError ? (
              <p className="mt-2 text-xs font-semibold text-expense">{exportError}</p>
            ) : null}
          </div>
        </div>
      </section>


      {loading ? (
        <p className="rounded-xl bg-surface p-5 text-center text-sm text-muted shadow-card">Memuat laporan...</p>
      ) : error ? (
        <div className="rounded-xl bg-surface p-5 text-center shadow-card">
          <p className="text-sm font-semibold text-error">{error}</p>
          <button className="mt-3 min-h-10 rounded-lg bg-surface-container px-4 text-sm font-bold text-primary" onClick={() => void load(mode === "month" ? `month=${month}` : `from=${customFrom}&to=${customTo}`)} type="button">Coba lagi</button>
        </div>
      ) : data ? (
        <>
          <section className="grid grid-cols-2 gap-3">
            <Metric title="Pemasukan" value={displayAmount(formatCurrency(data.totals.income_minor, "IDR"))} tone="income" icon={ArrowUpRight} />
            <Metric title="Pengeluaran" value={displayAmount(formatCurrency(data.totals.expense_minor, "IDR"))} tone="expense" icon={ArrowDownRight} />
          </section>

          <section className="rounded-xl bg-surface p-5 shadow-card">
            <h2 className="mb-1 text-lg font-bold text-ink">Saldo Bersih</h2>
            <p className={`text-2xl font-extrabold tabular-nums ${data.totals.net_minor >= 0 ? "text-income" : "text-expense"}`}>
              {displayAmount(formatCurrency(data.totals.net_minor, "IDR"))}
            </p>
          </section>

          {data.by_category.length > 0 ? (
            <section className="rounded-xl bg-surface p-5 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Pengeluaran per Kategori</h2>
              <div className="space-y-4">
                {data.by_category.map((row) => {
                  const pct = data.totals.expense_minor > 0 ? Math.min(100, Math.round((row.expense_minor / data.totals.expense_minor) * 100)) : 0;
                  return (
                    <div key={row.category_id ?? "uncategorized"}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-semibold">{row.category_name}</span>
                        <span className="text-muted">{displayAmount(formatCurrency(row.expense_minor, "IDR"))} · {pct}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-surface-container">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: row.category_color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {data.top_merchants.length > 0 ? (
            <section className="rounded-xl bg-surface p-5 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Top Merchant</h2>
              <div className="space-y-3">
                {data.top_merchants.map((merchant, index) => (
                  <div key={merchant.name} className="flex items-center gap-3">
                    {merchant.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={merchant.name} className="size-9 shrink-0 rounded-full object-cover" src={merchant.logo_url} />
                    ) : (
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-muted">
                        <Store size={16} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{merchant.name}</p>
                      <p className="text-xs text-muted">#{index + 1}</p>
                    </div>
                    <p className="shrink-0 font-bold text-expense">{displayAmount(formatCurrency(merchant.expense_minor, "IDR"))}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {data.trend.length > 0 ? (
            <section className="rounded-xl bg-surface p-5 shadow-card">
              <h2 className="mb-4 text-lg font-bold text-ink">Tren 6 Bulan</h2>
              <TrendChart trend={data.trend} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function TrendChart({ trend }: { trend: TrendRow[] }) {
  const max = Math.max(...trend.flatMap((row) => [row.income_minor, row.expense_minor]), 1);
  return (
    <div className="flex items-end justify-between gap-1.5">
      {trend.map((row) => {
        const incomeH = Math.round((row.income_minor / max) * 80);
        const expenseH = Math.round((row.expense_minor / max) * 80);
        return (
          <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-0.5">
              <div className="w-2 rounded-t bg-income/70 transition-all" style={{ height: `${incomeH}px` }} title={`Pemasukan ${row.month}`} />
              <div className="w-2 rounded-t bg-expense/70 transition-all" style={{ height: `${expenseH}px` }} title={`Pengeluaran ${row.month}`} />
            </div>
            <span className="truncate text-[9px] text-muted">{row.month.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ title, value, tone, icon: Icon }: { title: string; value: string; tone: "income" | "expense"; icon: typeof ArrowUpRight }) {
  return (
    <article className="rounded-xl bg-surface p-4 shadow-card">
      <div className={`mb-3 flex size-10 items-center justify-center rounded-full ${tone === "income" ? "bg-income/10 text-income" : "bg-error-container text-expense"}`}>
        <Icon size={20} />
      </div>
      <p className="text-sm text-muted">{title}</p>
      <p className={`mt-1 break-words text-base font-bold ${tone === "income" ? "text-income" : "text-expense"}`}>{value}</p>
    </article>
  );
}

function SheetChip({ color, label }: { color: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${color}`}>
      <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-white/80" />
      {label}
    </span>
  );
}
