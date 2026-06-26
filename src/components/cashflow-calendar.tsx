"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type CalendarDay = { day: string; income_minor: number; expense_minor: number; tx_count: number };

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

/** Format a minor amount (e.g. 150000) into compact Indonesian notation: 150rb, 1.5jt, 2M */
function compact(minor: number): string {
  const val = minor / 100;
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, "")}jt`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}rb`;
  return String(Math.round(val));
}

export function CashflowCalendar({ hidden }: { hidden: boolean }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/cashflow-calendar?month=${monthStr}`)
      .then((r) => r.ok ? r.json() : { calendar: [] })
      .then((json) => setData(json.calendar ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [monthStr]);

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const dayMap = new Map(data.map((d) => [d.day, d]));
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mt-6 rounded-xl bg-surface shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <button type="button" onClick={prev} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-container active:scale-95">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-sm font-bold text-ink">{MONTHS[month - 1]} {year}</h2>
        <button type="button" onClick={next} className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-container active:scale-95">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-outline/30">
        {DAYS.map((d) => (
          <span key={d} className="py-1 text-center text-[10px] font-bold uppercase text-muted">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="h-52 animate-pulse bg-surface-container/50 m-2 rounded-lg" />
      ) : (
        <div className="grid grid-cols-7 divide-x divide-y divide-outline/20">
          {/* Empty leading cells */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[4.5rem] bg-surface-container/20" />
          ))}

          {/* Date cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const info = dayMap.get(dayStr);
            const isToday = dayStr === today;
            const income = info?.income_minor ?? 0;
            const expense = info?.expense_minor ?? 0;
            const hasData = income > 0 || expense > 0;

            return (
              <div
                key={dayStr}
                className={`min-h-[4.5rem] flex flex-col items-center pt-1.5 pb-1 px-0.5 gap-0.5 ${isToday ? "bg-primary/5" : ""}`}
              >
                {/* Date number */}
                <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold leading-none ${isToday ? "bg-primary text-white" : "text-ink"}`}>
                  {dayNum}
                </span>

                {/* Amounts — always visible when data exists */}
                {hasData ? (
                  <div className="flex w-full flex-col items-center gap-px">
                    {income > 0 ? (
                      <span className={`w-full truncate text-center text-[9px] font-bold leading-tight ${hidden ? "text-muted" : "text-income"}`}>
                        {hidden ? "••" : `+${compact(income)}`}
                      </span>
                    ) : null}
                    {expense > 0 ? (
                      <span className={`w-full truncate text-center text-[9px] font-bold leading-tight ${hidden ? "text-muted" : "text-expense"}`}>
                        {hidden ? "••" : `-${compact(expense)}`}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="h-4" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-outline/20">
        <span className="flex items-center gap-1 text-[10px] text-muted">
          <span className="font-bold text-income">+</span> Pemasukan
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted">
          <span className="font-bold text-expense">-</span> Pengeluaran
        </span>
      </div>
    </section>
  );
}
