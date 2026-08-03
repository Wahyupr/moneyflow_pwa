"use client";

import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Minus,
  RefreshCw,
  Store,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { formatCurrency } from "@/lib/money";
import type { ReportData, TrendRow } from "@/lib/reports-data";

type PeriodMode = "month" | "custom";
type CustomRange = { from: string; to: string };

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

function formatDelta(current: number, previous: number): { label: string; tone: "good" | "bad" | "flat"; value: number } {
  if (previous === 0) {
    if (current === 0) return { label: "0%", tone: "flat", value: 0 };
    return { label: "+100%", tone: current > 0 ? "good" : "bad", value: 100 };
  }

  const value = Math.round(((current - previous) / Math.abs(previous)) * 100);
  return {
    label: `${value > 0 ? "+" : ""}${value}%`,
    tone: value > 0 ? "good" : value < 0 ? "bad" : "flat",
    value
  };
}

function buildParams(mode: PeriodMode, month: string, custom: CustomRange | null): string | null {
  if (mode === "month") return `month=${month}`;
  if (custom?.from && custom.to && custom.from <= custom.to) return `from=${custom.from}&to=${custom.to}`;
  return null;
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
  const [appliedCustom, setAppliedCustom] = useState<CustomRange | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const activeParams = useMemo(() => buildParams(mode, month, appliedCustom), [mode, month, appliedCustom]);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const canGoNext = month < thisMonth;

  const load = useCallback(async (params: string, signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/summary?${params}`, { signal });
      if (!response.ok) {
        setError("Gagal memuat laporan.");
        return;
      }
      setData(await response.json());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Gagal memuat laporan.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeParams) return;
    const controller = new AbortController();
    void load(activeParams, controller.signal);
    return () => controller.abort();
  }, [activeParams, load]);

  function selectMode(next: PeriodMode) {
    setMode(next);
    setExportError(null);
    setExportSuccess(null);
  }

  function applyCustom() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    setMode("custom");
    setAppliedCustom({ from: customFrom, to: customTo });
  }

  async function exportExcel() {
    if (!activeParams) return;
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const response = await fetch(`/api/reports/export?${activeParams}`);
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
      const filename = match ? decodeURIComponent(match[1]) : fallbackMatch ? fallbackMatch[1] : "laporan-keuangan.xlsx";
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(`${filename} siap diunduh.`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Gagal mengekspor laporan.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mt-3 w-full min-w-0 space-y-3 pb-40 lg:mt-4 lg:space-y-4 lg:pb-6">
      <PeriodToolbar
        mode={mode}
        month={month}
        customFrom={customFrom}
        customTo={customTo}
        appliedCustom={appliedCustom}
        canGoNext={canGoNext}
        onMode={selectMode}
        onMonth={setMonth}
        onCustomFrom={setCustomFrom}
        onCustomTo={setCustomTo}
        onApplyCustom={applyCustom}
      />

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => activeParams && void load(activeParams)} />
      ) : data ? (
        <ReportDashboard
          data={data}
          displayAmount={displayAmount}
          exporting={exporting}
          exportDisabled={!activeParams || loading}
          exportError={exportError}
          exportSuccess={exportSuccess}
          onExport={() => void exportExcel()}
        />
      ) : null}
    </div>
  );
}

function PeriodToolbar({
  mode,
  month,
  customFrom,
  customTo,
  appliedCustom,
  canGoNext,
  onMode,
  onMonth,
  onCustomFrom,
  onCustomTo,
  onApplyCustom
}: {
  mode: PeriodMode;
  month: string;
  customFrom: string;
  customTo: string;
  appliedCustom: CustomRange | null;
  canGoNext: boolean;
  onMode: (mode: PeriodMode) => void;
  onMonth: (month: string) => void;
  onCustomFrom: (value: string) => void;
  onCustomTo: (value: string) => void;
  onApplyCustom: () => void;
}) {
  const invalidCustom = !customFrom || !customTo || customFrom > customTo;

  return (
    <section className="w-full min-w-0 rounded-xl border border-outline bg-surface p-3 shadow-card sm:rounded-2xl sm:p-4">
      <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full grid-cols-2 rounded-lg bg-surface-low p-1 lg:inline-grid lg:max-w-xs">
          <button
            type="button"
            onClick={() => onMode("month")}
            className={`min-h-10 rounded-md px-3 text-sm font-bold transition ${
              mode === "month" ? "bg-surface text-primary shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            Per Bulan
          </button>
          <button
            type="button"
            onClick={() => onMode("custom")}
            className={`min-h-10 rounded-md px-3 text-sm font-bold transition ${
              mode === "custom" ? "bg-surface text-primary shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            Custom
          </button>
        </div>

        {mode === "month" ? (
          <div className="grid w-full grid-cols-[44px_1fr_44px] items-center gap-2 lg:min-w-[280px]">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-md bg-surface-low text-muted transition hover:text-ink active:scale-95"
              onClick={() => onMonth(prevMonth(month))}
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="min-w-0 truncate text-center text-base font-bold capitalize text-ink">{monthLabel(month)}</span>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-md bg-surface-low text-muted transition hover:text-ink active:scale-95 disabled:opacity-30"
              onClick={() => onMonth(nextMonth(month))}
              disabled={!canGoNext}
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        ) : (
          <div className="grid w-full gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <DateField label="Dari" value={customFrom} max={customTo || undefined} onChange={onCustomFrom} />
            <DateField
              label="Sampai"
              value={customTo}
              min={customFrom || undefined}
              max={new Date().toISOString().slice(0, 10)}
              onChange={onCustomTo}
            />
            <button
              type="button"
              className="min-h-10 rounded-lg bg-primary px-5 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              disabled={invalidCustom}
              onClick={onApplyCustom}
            >
              Lihat
            </button>
          </div>
        )}
      </div>

      {mode === "custom" ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted">
          <CalendarDays size={14} />
          {appliedCustom ? `Periode aktif: ${appliedCustom.from} sampai ${appliedCustom.to}` : "Pilih tanggal lalu tekan Lihat."}
        </p>
      ) : null}
    </section>
  );
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{label}</span>
      <input
        type="date"
        className="mt-1 min-h-10 w-full rounded-lg border border-outline bg-background px-3 text-sm focus:border-primary focus:outline-none"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ReportDashboard({
  data,
  displayAmount,
  exporting,
  exportDisabled,
  exportError,
  exportSuccess,
  onExport
}: {
  data: ReportData;
  displayAmount: (value: string) => string;
  exporting: boolean;
  exportDisabled: boolean;
  exportError: string | null;
  exportSuccess: string | null;
  onExport: () => void;
}) {
  const hasTransactions = data.totals.transaction_count > 0;
  const netDelta = formatDelta(data.totals.net_minor, data.previous_totals.net_minor);
  const expenseDelta = formatDelta(data.totals.expense_minor, data.previous_totals.expense_minor);
  const topCategory = data.by_category[0];
  const topMerchant = data.top_merchants[0];

  if (!hasTransactions) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <EmptyReport data={data} displayAmount={displayAmount} />
        <ExportPanel
          data={data}
          exporting={exporting}
          disabled={exportDisabled}
          exportError={exportError}
          exportSuccess={exportSuccess}
          onExport={onExport}
        />
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] xl:gap-4">
      <div className="min-w-0 space-y-3 xl:space-y-4">
        <SummaryHero data={data} displayAmount={displayAmount} netDelta={netDelta} expenseDelta={expenseDelta} />

        <div className="grid min-w-0 gap-3 lg:grid-cols-2 xl:gap-4">
          <CategoryPanel data={data} displayAmount={displayAmount} />
          <MerchantPanel data={data} displayAmount={displayAmount} />
        </div>

        <TrendPanel trend={data.trend} displayAmount={displayAmount} />
      </div>

      <aside className="min-w-0 space-y-3 xl:space-y-4">
        <InsightPanel data={data} topCategory={topCategory} topMerchant={topMerchant} displayAmount={displayAmount} />
        <ExportPanel
          data={data}
          exporting={exporting}
          disabled={exportDisabled}
          exportError={exportError}
          exportSuccess={exportSuccess}
          onExport={onExport}
        />
      </aside>
    </div>
  );
}

function SummaryHero({
  data,
  displayAmount,
  netDelta,
  expenseDelta
}: {
  data: ReportData;
  displayAmount: (value: string) => string;
  netDelta: ReturnType<typeof formatDelta>;
  expenseDelta: ReturnType<typeof formatDelta>;
}) {
  const positive = data.totals.net_minor > 0;
  const neutral = data.totals.net_minor === 0;
  const status = positive ? "Surplus" : neutral ? "Impas" : "Defisit";

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-xl border border-outline bg-surface p-4 shadow-card sm:rounded-2xl sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">{data.window.description}</p>
          <h2 className="mt-1 text-xl font-extrabold leading-tight text-ink sm:text-3xl">
            {status} {displayAmount(formatCurrency(Math.abs(data.totals.net_minor), "IDR"))}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm font-medium text-muted">
            {positive
              ? `Kamu menyisakan ${data.totals.savings_rate_pct}% dari pemasukan periode ini.`
              : neutral
                ? "Pemasukan dan pengeluaran periode ini seimbang."
                : "Pengeluaran melewati pemasukan pada periode ini."}
          </p>
        </div>
        <DeltaBadge label="Net vs sebelumnya" delta={netDelta} invertTone={false} />
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-3 gap-1.5 sm:gap-3">
        <MetricTile icon={<ArrowUpRight size={16} />} label="Pemasukan" value={displayAmount(formatCurrency(data.totals.income_minor, "IDR"))} />
        <MetricTile icon={<ArrowDownRight size={16} />} label="Pengeluaran" value={displayAmount(formatCurrency(data.totals.expense_minor, "IDR"))} />
        <MetricTile icon={<BarChart2 size={16} />} label="Transaksi" value={`${data.totals.transaction_count}`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted sm:text-xs">
        <span className="rounded-md bg-surface-low px-2 py-1">Savings {data.totals.savings_rate_pct}%</span>
        <span className="rounded-md bg-surface-low px-2 py-1">Expense {expenseDelta.label}</span>
        <span className="rounded-md bg-surface-low px-2 py-1">{new Date(data.generated_at).toLocaleString("id-ID")}</span>
      </div>
    </section>
  );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-low p-2 sm:p-3">
      <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-muted sm:text-xs">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-[13px] font-extrabold text-ink tabular-nums sm:text-base">{value}</p>
    </div>
  );
}

function DeltaBadge({ label, delta, invertTone }: { label: string; delta: ReturnType<typeof formatDelta>; invertTone: boolean }) {
  const good = invertTone ? delta.value < 0 : delta.value >= 0;
  const tone = delta.tone === "flat" ? "bg-surface-low text-muted" : good ? "bg-income/10 text-income" : "bg-expense/10 text-expense";
  return (
    <div className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold sm:text-sm ${tone}`}>
      {delta.value > 0 ? <TrendingUp size={16} /> : delta.value < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
      <span>{label}: {delta.label}</span>
    </div>
  );
}

function InsightPanel({
  data,
  topCategory,
  topMerchant,
  displayAmount
}: {
  data: ReportData;
  topCategory: ReportData["by_category"][number] | undefined;
  topMerchant: ReportData["top_merchants"][number] | undefined;
  displayAmount: (value: string) => string;
}) {
  const message = topCategory
    ? `${topCategory.category_name} mengambil ${topCategory.expense_pct}% dari pengeluaran.`
    : "Belum ada kategori dominan pada periode ini.";

  return (
    <section className="w-full min-w-0 rounded-xl border border-outline bg-surface p-4 shadow-card sm:rounded-2xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <AlertCircle size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-ink">Insight periode ini</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <InsightRow label="Merchant terbesar" value={topMerchant ? `${topMerchant.name} · ${displayAmount(formatCurrency(topMerchant.expense_minor, "IDR"))}` : "Belum ada"} />
        <InsightRow label="Savings rate" value={`${data.totals.savings_rate_pct}%`} />
        <InsightRow label="Transaksi" value={`${data.totals.transaction_count} transaksi`} />
      </div>
    </section>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-surface-container pt-3">
      <span className="text-muted">{label}</span>
      <span className="text-right font-bold text-ink">{value}</span>
    </div>
  );
}

function CategoryPanel({ data, displayAmount }: { data: ReportData; displayAmount: (value: string) => string }) {
  return (
    <section className="w-full min-w-0 rounded-xl border border-outline bg-surface p-4 shadow-card sm:rounded-2xl sm:p-5">
      <PanelTitle icon={<BarChart2 size={16} />} title="Kategori" tone="primary" />
      {data.by_category.length === 0 ? (
        <MiniEmpty message="Belum ada pengeluaran per kategori." />
      ) : (
        <div className="mt-4 space-y-4">
          {data.by_category.slice(0, 6).map((row, index) => (
            <div key={row.category_id ?? "uncategorized"}>
              <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                    style={{ backgroundColor: row.category_color }}
                  >
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-bold text-ink">{row.category_name}</span>
                </div>
                <div className="max-w-[44vw] shrink-0 text-right sm:max-w-none">
                  <p className="truncate text-sm font-extrabold tabular-nums text-ink">{displayAmount(formatCurrency(row.expense_minor, "IDR"))}</p>
                  <p className="text-[11px] font-semibold text-muted">{row.expense_pct}% · {row.transaction_count} tx</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.expense_pct)}%`, backgroundColor: row.category_color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MerchantPanel({ data, displayAmount }: { data: ReportData; displayAmount: (value: string) => string }) {
  const maxExpense = data.top_merchants[0]?.expense_minor ?? 1;

  return (
    <section className="w-full min-w-0 rounded-xl border border-outline bg-surface p-4 shadow-card sm:rounded-2xl sm:p-5">
      <PanelTitle icon={<Store size={16} />} title="Top Merchant" tone="warning" />
      {data.top_merchants.length === 0 ? (
        <MiniEmpty message="Belum ada merchant pada periode ini." />
      ) : (
        <div className="mt-4 space-y-2.5">
          {data.top_merchants.slice(0, 6).map((merchant, index) => {
            const pct = Math.max(5, Math.round((merchant.expense_minor / maxExpense) * 100));
            return (
              <div key={merchant.name} className="relative min-w-0 overflow-hidden rounded-xl bg-surface-low p-3">
                <div className="absolute inset-y-0 left-0 bg-warning/10" style={{ width: `${pct}%` }} />
                <div className="relative grid min-w-0 grid-cols-[36px_minmax(0,1fr)] gap-3 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:items-center">
                  {merchant.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={merchant.name} className="size-9 shrink-0 rounded-lg object-cover" src={merchant.logo_url} />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-muted">
                      <Store size={15} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-ink sm:truncate sm:leading-normal">#{index + 1} {merchant.name}</p>
                    <p className="text-[11px] font-semibold text-muted">{merchant.transaction_count} transaksi</p>
                  </div>
                  <p className="col-start-2 text-right text-sm font-extrabold text-expense tabular-nums sm:col-start-auto sm:shrink-0">
                    {displayAmount(formatCurrency(merchant.expense_minor, "IDR"))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TrendPanel({ trend, displayAmount }: { trend: TrendRow[]; displayAmount: (value: string) => string }) {
  return (
    <section className="w-full min-w-0 rounded-xl border border-outline bg-surface p-4 shadow-card sm:rounded-2xl sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <PanelTitle icon={<TrendingUp size={16} />} title="Tren 6 Bulan" tone="income" />
        <div className="flex items-center gap-2 text-[11px] sm:gap-3 sm:text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-income"><span className="h-2 w-3 rounded-sm bg-income" />Pemasukan</span>
          <span className="flex items-center gap-1.5 font-semibold text-expense"><span className="h-2 w-3 rounded-sm bg-expense" />Pengeluaran</span>
        </div>
      </div>
      {trend.length === 0 ? <MiniEmpty message="Belum ada tren yang bisa ditampilkan." /> : <TrendChart trend={trend} displayAmount={displayAmount} />}
    </section>
  );
}

function TrendChart({ trend, displayAmount }: { trend: TrendRow[]; displayAmount: (value: string) => string }) {
  const max = Math.max(...trend.flatMap((row) => [row.income_minor, row.expense_minor]), 1);

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="grid min-w-0 grid-cols-6 items-end gap-1.5 sm:gap-3" role="img" aria-label="Grafik pemasukan dan pengeluaran enam bulan">
        {trend.map((row) => {
          const incomeH = Math.max(8, Math.round((row.income_minor / max) * 92));
          const expenseH = Math.max(8, Math.round((row.expense_minor / max) * 92));
          return (
            <div key={row.month} className="flex flex-col items-center gap-2">
              <div className="flex h-28 w-full items-end justify-center gap-1 rounded-lg bg-surface-low px-1 pb-2 sm:gap-1.5 sm:px-2">
                <div
                  className="w-full max-w-4 rounded-t bg-income sm:max-w-5"
                  style={{ height: `${incomeH}px` }}
                  title={`Pemasukan ${monthLabelShort(row.month)} ${displayAmount(formatCurrency(row.income_minor, "IDR"))}`}
                />
                <div
                  className="w-full max-w-4 rounded-t bg-expense sm:max-w-5"
                  style={{ height: `${expenseH}px` }}
                  title={`Pengeluaran ${monthLabelShort(row.month)} ${displayAmount(formatCurrency(row.expense_minor, "IDR"))}`}
                />
              </div>
              <div className="w-full text-center">
                <p className="truncate text-[10px] font-bold text-ink sm:text-xs">{monthLabelShort(row.month)}</p>
                <p className="hidden truncate text-[10px] font-semibold text-muted sm:block" title={displayAmount(formatCurrency(row.expense_minor, "IDR"))}>
                  {displayAmount(formatCurrency(row.expense_minor, "IDR"))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExportPanel({
  data,
  exporting,
  disabled,
  exportError,
  exportSuccess,
  onExport
}: {
  data: ReportData;
  exporting: boolean;
  disabled: boolean;
  exportError: string | null;
  exportSuccess: string | null;
  onExport: () => void;
}) {
  return (
    <section className="rounded-xl border border-outline bg-surface p-4 shadow-card sm:rounded-2xl sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileSpreadsheet size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">Download Excel</h2>
          <p className="mt-1 text-sm text-muted">6 sheet siap analisis, dengan angka IDR utuh dan AI Insight fallback.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-muted">
        {["Ringkasan", "Kategori", "Merchant", "Tren", "Transaksi", "AI Insight"].map((sheet) => (
          <span key={sheet} className="rounded-lg bg-surface-low px-2.5 py-2">{sheet}</span>
        ))}
      </div>

      <button
        type="button"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
        disabled={disabled || exporting}
        onClick={onExport}
      >
        <Download size={16} className={exporting ? "animate-bounce" : ""} />
        {exporting ? "Menyiapkan workbook..." : `Download ${data.window.description}`}
      </button>

      {exportSuccess ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-income">
          <CheckCircle2 size={14} />
          {exportSuccess}
        </p>
      ) : null}
      {exportError ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-bold text-expense">
          <AlertCircle size={14} />
          {exportError}
        </p>
      ) : null}
    </section>
  );
}

function PanelTitle({ icon, title, tone }: { icon: React.ReactNode; title: string; tone: "primary" | "warning" | "income" }) {
  const toneClass = tone === "warning" ? "bg-warning/10 text-warning" : tone === "income" ? "bg-income/10 text-income" : "bg-primary/10 text-primary";
  return (
    <div className="flex items-center gap-2">
      <span className={`flex size-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
      <h2 className="text-base font-bold text-ink">{title}</h2>
    </div>
  );
}

function EmptyReport({ data, displayAmount }: { data: ReportData; displayAmount: (value: string) => string }) {
  return (
    <section className="rounded-2xl border border-dashed border-outline bg-surface p-8 text-center shadow-card">
      <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-surface-low text-muted">
        <BarChart2 size={22} />
      </span>
      <h2 className="mt-4 text-lg font-extrabold text-ink">Belum ada transaksi di {data.window.description}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Setelah ada pemasukan atau pengeluaran, laporan akan menampilkan kategori, merchant, tren, dan insight otomatis.
      </p>
      <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-2 text-xs font-bold text-muted">
        <span className="rounded-lg bg-surface-low px-2 py-2">Pemasukan {displayAmount(formatCurrency(data.totals.income_minor, "IDR"))}</span>
        <span className="rounded-lg bg-surface-low px-2 py-2">Pengeluaran {displayAmount(formatCurrency(data.totals.expense_minor, "IDR"))}</span>
        <span className="rounded-lg bg-surface-low px-2 py-2">{data.totals.transaction_count} tx</span>
      </div>
    </section>
  );
}

function MiniEmpty({ message }: { message: string }) {
  return <p className="mt-4 rounded-lg bg-surface-low px-3 py-4 text-center text-sm font-semibold text-muted">{message}</p>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-2xl border border-expense/20 bg-surface p-6 text-center shadow-card">
      <AlertCircle className="mx-auto text-expense" size={28} />
      <p className="mt-3 text-sm font-bold text-expense">{message}</p>
      <button
        type="button"
        className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary/10 px-5 text-sm font-bold text-primary transition active:scale-[0.98]"
        onClick={onRetry}
      >
        <RefreshCw size={15} />
        Coba lagi
      </button>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
      <div className="space-y-4">
        <div className="h-56 animate-pulse rounded-2xl bg-surface-container" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-surface-container" />
          <div className="h-72 animate-pulse rounded-2xl bg-surface-container" />
        </div>
        <div className="h-60 animate-pulse rounded-2xl bg-surface-container" />
      </div>
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-2xl bg-surface-container" />
        <div className="h-64 animate-pulse rounded-2xl bg-surface-container" />
      </div>
    </div>
  );
}
