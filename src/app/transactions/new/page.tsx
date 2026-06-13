"use client";

import { Save } from "lucide-react";
import { AppFrame } from "@/components/app-frame";
import { dashboardModel } from "@/lib/demo-data";

export default function NewTransactionPage() {
  return (
    <AppFrame title="Catat Manual" subtitle="Tambah transaksi">
      <form className="mt-5 space-y-4 rounded-xl bg-surface p-4 shadow-card">
        <Field label="Nama transaksi" placeholder="Makan siang" />
        <Field label="Nominal" placeholder="50000" inputMode="numeric" />
        <label className="block">
          <span className="text-sm font-semibold text-muted">Tipe</span>
          <select className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-ink focus:border-primary focus:outline-none">
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-muted">Dompet</span>
          <select className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-ink focus:border-primary focus:outline-none">
            {dashboardModel.wallets.map((wallet) => (
              <option key={wallet.id}>{wallet.name}</option>
            ))}
          </select>
        </label>
        <Field label="Catatan" placeholder="Opsional" />
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" type="button">
          <Save size={18} />
          Simpan Transaksi
        </button>
      </form>
    </AppFrame>
  );
}

function Field({ label, placeholder, inputMode }: { label: string; placeholder: string; inputMode?: "numeric" }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 text-ink placeholder:text-muted focus:border-primary focus:outline-none" placeholder={placeholder} inputMode={inputMode} />
    </label>
  );
}
