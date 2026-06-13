"use client";

import { Bell, Plus, Repeat, ShieldAlert } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";

const subscriptions = [
  { name: "Spotify", date: "15 Juni", amount: "Rp 54.990", tone: "income" },
  { name: "Disney+", date: "Perlu Konfirmasi", amount: "Rp 39.000", tone: "warning" }
];

export default function RemindersPage() {
  return (
    <AppFrame title="Pengingat" subtitle="Langganan">
      <RemindersContent />
    </AppFrame>
  );
}

function RemindersContent() {
  const { displayAmount } = usePrivacy();

  return (
    <div className="mt-5 space-y-5">
      <section className="rounded-xl bg-surface p-5 shadow-card">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
            <span className="font-bold">N</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Netflix</h2>
            <p className="text-sm text-muted">Jatuh tempo: 01 Juni</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{displayAmount("Rp 186.000")}</p>
            <span className="mt-1 inline-flex rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-white">AKTIF</span>
          </div>
        </div>
        <div className="space-y-4 border-t border-surface-container pt-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Periode Notifikasi</p>
            <div className="flex flex-wrap gap-2">
              {["7 hari sebelum", "3 hari sebelum", "1 hari sebelum"].map((item, index) => (
                <button className={`min-h-10 rounded-full px-4 text-sm font-semibold ${index === 1 ? "bg-primary text-white" : "bg-surface-container text-muted"}`} key={item} type="button">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-surface-low p-3">
            <Repeat className="text-primary" size={20} />
            <span className="font-semibold">Setiap bulan</span>
          </div>
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-sm font-bold text-muted">LANGGANAN LAINNYA</h3>
        <div className="space-y-3">
          {subscriptions.map((item) => (
            <article className={`flex items-center justify-between rounded-xl bg-surface p-4 shadow-card ${item.tone === "warning" ? "border-2 border-dashed border-warning" : ""}`} key={item.name}>
              <div className="flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-full ${item.tone === "warning" ? "bg-surface-container text-warning" : "bg-income/10 text-income"}`}>
                  {item.tone === "warning" ? <ShieldAlert size={18} /> : <Bell size={18} />}
                </div>
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className={`text-sm ${item.tone === "warning" ? "text-warning" : "text-muted"}`}>{item.date}</p>
                </div>
              </div>
              <p className="font-semibold">{displayAmount(item.amount)}</p>
            </article>
          ))}
        </div>
      </section>
      <button className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-bold text-white shadow-card active:scale-[0.98]" type="button">
        <Plus size={20} />
        Tambah Pengingat Baru
      </button>
    </div>
  );
}
