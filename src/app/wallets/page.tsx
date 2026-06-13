"use client";

import { ArrowDownToLine, ArrowRightLeft, Plus, Save, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { WalletCard } from "@/components/wallet-card";
import { dashboardModel } from "@/lib/demo-data";
import { validateWalletInput, type WalletInput, type WalletType } from "@/lib/wallets";

type WalletItem = (typeof dashboardModel.wallets)[number] & {
  institution_name?: string | null;
  account_number?: string | null;
  phone_number?: string | null;
  opening_balance_minor?: number;
};

const emptyForm: WalletInput = {
  name: "",
  type: "cash",
  currency: "IDR",
  color: "#006948",
  icon: "wallet",
  institution_name: "",
  account_number: "",
  phone_number: "",
  opening_balance_minor: 0
};

export default function WalletsPage() {
  return (
    <AppFrame title="Wallet Management" subtitle="Dompet">
      <WalletsContent />
    </AppFrame>
  );
}

function WalletsContent() {
  const { hidden } = usePrivacy();
  const [wallets, setWallets] = useState<WalletItem[]>(dashboardModel.wallets);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WalletInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(wallet: WalletItem) {
    setEditingId(wallet.id);
    setForm({
      name: wallet.name,
      type: wallet.type as WalletType,
      currency: "IDR",
      color: wallet.color,
      icon: wallet.icon,
      institution_name: wallet.institution_name ?? "",
      account_number: wallet.account_number ?? "",
      phone_number: wallet.phone_number ?? "",
      opening_balance_minor: wallet.opening_balance_minor ?? wallet.balance_minor
    });
    setErrors({});
    setFormOpen(true);
  }

  async function saveWallet() {
    const validation = validateWalletInput(form);

    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    const normalized: WalletItem = {
      id: editingId ?? `wallet-${Date.now()}`,
      name: validation.data.name,
      type: validation.data.type,
      balance_minor: validation.data.opening_balance_minor,
      income_minor: 0,
      expense_minor: 0,
      color: validation.data.color,
      icon: validation.data.icon,
      shared: false,
      institution_name: validation.data.institution_name,
      account_number: validation.data.account_number,
      phone_number: validation.data.phone_number,
      opening_balance_minor: validation.data.opening_balance_minor
    };

    setWallets((current) => (editingId ? current.map((wallet) => (wallet.id === editingId ? { ...wallet, ...normalized } : wallet)) : [normalized, ...current]));
    setFormOpen(false);

    const endpoint = editingId ? `/api/wallets/${editingId}` : "/api/wallets";
    await fetch(endpoint, {
      method: editingId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validation.data)
    }).catch(() => undefined);
  }

  async function deleteWallet(id: string) {
    setWallets((current) => current.filter((wallet) => wallet.id !== id));
    await fetch(`/api/wallets/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  return (
    <div className="mt-5 space-y-6">
      <section className="rounded-xl bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
            <WalletCards aria-hidden="true" size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-ink">Aksi Dompet</h2>
            <p className="text-sm text-muted">Top Up dan Transfer</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-bold text-white shadow-card active:scale-[0.98]" type="button">
            <ArrowDownToLine aria-hidden="true" size={18} />
            Top Up
          </button>
          <button className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-secondary px-4 text-base font-bold text-white shadow-card active:scale-[0.98]" type="button">
            <ArrowRightLeft aria-hidden="true" size={18} />
            Transfer
          </button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">Dompet Saya</h2>
          <button className="flex min-h-11 items-center gap-2 rounded-lg bg-surface-container px-3 text-sm font-bold text-primary active:scale-[0.98]" onClick={openCreate} type="button">
            <Plus aria-hidden="true" size={16} />
            Tambah
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
          {wallets.map((wallet) => (
            <WalletCard hidden={hidden} key={wallet.id} wallet={wallet} onDelete={() => deleteWallet(wallet.id)} onEdit={() => openEdit(wallet)} />
          ))}
        </div>
      </section>

      {formOpen ? (
        <section className="fixed inset-0 z-[70] flex items-end bg-ink/20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-sm md:items-center md:justify-center">
          <div className="w-full max-w-md rounded-xl bg-surface p-4 shadow-lift">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{editingId ? "Edit Dompet" : "Tambah Dompet"}</h2>
              <button className="flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-container" onClick={() => setFormOpen(false)} type="button" aria-label="Tutup form dompet">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70dvh] space-y-3 overflow-y-auto pr-1">
              <Input label="Nama" value={form.name ?? ""} onChange={(value) => setForm((current) => ({ ...current, name: value }))} error={errors.name} />
              <label className="block">
                <span className="text-sm font-semibold text-muted">Tipe</span>
                <select className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as WalletType }))}>
                  <option value="cash">Cash</option>
                  <option value="bank">Rekening Bank</option>
                  <option value="ewallet">E-Wallet</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="savings">Tabungan</option>
                  <option value="investment">Investasi</option>
                </select>
              </label>
              <Input label="Institusi" value={form.institution_name ?? ""} onChange={(value) => setForm((current) => ({ ...current, institution_name: value }))} />
              {form.type === "ewallet" ? (
                <Input label="Nomor HP" value={form.phone_number ?? ""} onChange={(value) => setForm((current) => ({ ...current, phone_number: value }))} error={errors.phone_number} inputMode="tel" />
              ) : null}
              {form.type === "bank" ? (
                <Input label="Nomor Rekening" value={form.account_number ?? ""} onChange={(value) => setForm((current) => ({ ...current, account_number: value }))} error={errors.account_number} inputMode="numeric" />
              ) : null}
              <Input label="Saldo Awal" value={String(form.opening_balance_minor ?? 0)} onChange={(value) => setForm((current) => ({ ...current, opening_balance_minor: Number(value) || 0 }))} error={errors.opening_balance_minor} inputMode="numeric" />
              <Input label="Warna" value={form.color ?? "#006948"} onChange={(value) => setForm((current) => ({ ...current, color: value }))} error={errors.color} />
              <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={saveWallet} type="button">
                <Save size={18} />
                Simpan Dompet
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  error,
  inputMode
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputMode?: "numeric" | "tel";
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={value} onChange={(event) => onChange(event.target.value)} inputMode={inputMode} />
      {error ? <span className="mt-1 block text-sm text-error">{error}</span> : null}
    </label>
  );
}
