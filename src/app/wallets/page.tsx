"use client";

import {
  ArrowDownToLine,
  ArrowRightLeft,
  CreditCard,
  Pencil,
  Plus,
  Save,
  Smartphone,
  Trash2,
  UsersRound,
  Wallet,
  WalletCards,
  X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { usePrivacy } from "@/components/privacy-provider";
import { SelectMenu } from "@/components/ui/select-menu";
import { formatCurrency } from "@/lib/money";
import { validateWalletInput, type WalletInput, type WalletType } from "@/lib/wallets";

const ROW_ICONS: Record<string, typeof Wallet> = {
  "credit-card": CreditCard,
  smartphone: Smartphone,
  users: UsersRound,
  wallet: Wallet
};


import { getProvidersForType, getProviderColor, TYPE_DEFAULT_COLORS } from "@/lib/wallet-providers";

const TYPE_LABELS: Record<WalletType, string> = {
  cash: "Cash",
  bank: "Rekening Bank",
  ewallet: "E-Wallet",
  credit_card: "Credit Card",
  savings: "Tabungan",
  investment: "Investasi"
};

/** Maps a wallet type to the card icon key used by WalletCard. */
const TYPE_ICONS: Record<WalletType, string> = {
  cash: "wallet",
  bank: "credit-card",
  ewallet: "smartphone",
  credit_card: "credit-card",
  savings: "users",
  investment: "wallet"
};


type WalletRow = {
  id: string;
  name: string;
  type: WalletType;
  currency: string;
  color: string;
  icon: string;
  is_shared: boolean;
  opening_balance_minor: number;
  institution_name: string | null;
  account_number: string | null;
  phone_number: string | null;
  balance_minor: number;
  income_minor: number;
  expense_minor: number;
};

const emptyForm: WalletInput = {
  name: "",
  type: "cash",
  currency: "IDR",
  color: "#1668DC",
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
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WalletInput>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Manual mode lets the user type a provider not in the master list and pick
  // the card color themselves.
  const [manualProvider, setManualProvider] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/wallets");
      if (!response.ok) {
        setLoadError("Gagal memuat dompet.");
        return;
      }
      const payload = await response.json();
      setWallets((payload.wallets ?? []) as WalletRow[]);
    } catch {
      setLoadError("Gagal memuat dompet.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setManualProvider(false);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(wallet: WalletRow) {
    setEditingId(wallet.id);
    setForm({
      name: wallet.name,
      type: wallet.type,
      currency: wallet.currency,
      color: wallet.color,
      icon: wallet.icon,
      institution_name: wallet.institution_name ?? "",
      account_number: wallet.account_number ?? "",
      phone_number: wallet.phone_number ?? "",
      opening_balance_minor: wallet.opening_balance_minor
    });
    // If the saved provider isn't in the master list, edit it in manual mode.
    const known = getProvidersForType(wallet.type)?.some((provider) => provider.name === wallet.institution_name);
    setManualProvider((wallet.type === "ewallet" || wallet.type === "bank") && Boolean(wallet.institution_name) && !known);
    setErrors({});
    setFormOpen(true);
  }


  // Changing type resets the provider/color/icon to sensible defaults for that
  // type. For cash/credit_card/savings/investment the color comes from a preset;
  // for bank/ewallet the color is decided once a provider is picked.
  function changeType(nextType: WalletType) {
    setForm((current) => ({
      ...current,
      type: nextType,
      institution_name: "",
      account_number: "",
      phone_number: "",
      icon: TYPE_ICONS[nextType],
      color: TYPE_DEFAULT_COLORS[nextType] ?? current.color
    }));
  }

  // Picking a provider sets institution_name and auto-applies the brand color so
  // the wallet card looks like e.g. GoPay / BCA.
  function changeProvider(providerName: string) {
    setForm((current) => {
      const brandColor = getProviderColor(current.type ?? "cash", providerName);
      return {
        ...current,
        institution_name: providerName,
        name: current.name?.trim() ? current.name : providerName,
        color: brandColor ?? current.color
      };
    });
  }

  async function saveWallet() {
    const validation = validateWalletInput(form);


    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const endpoint = editingId ? `/api/wallets/${editingId}` : "/api/wallets";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validation.data)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.errors) {
          setErrors(payload.errors as Record<string, string>);
        } else {
          setErrors({ form: payload?.error ?? "Gagal menyimpan dompet." });
        }
        return;
      }

      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteWallet(id: string) {
    const response = await fetch(`/api/wallets/${id}`, { method: "DELETE" });
    if (response.ok) {
      if (editingId === id) {
        setFormOpen(false);
      }
      await load();
    }
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

        {loading ? (
          <p className="rounded-xl bg-surface p-5 text-center text-sm text-muted shadow-card">Memuat dompet...</p>
        ) : loadError ? (
          <div className="rounded-xl bg-surface p-5 text-center shadow-card">
            <p className="text-sm font-semibold text-error">{loadError}</p>
            <button className="mt-3 min-h-10 rounded-lg bg-surface-container px-4 text-sm font-bold text-primary active:scale-[0.98]" onClick={() => void load()} type="button">
              Coba lagi
            </button>
          </div>
        ) : wallets.length === 0 ? (
          <div className="rounded-xl bg-surface p-6 text-center shadow-card">
            <p className="font-semibold text-ink">Belum ada dompet</p>
            <p className="mt-1 text-sm text-muted">Tambahkan dompet pertama Anda untuk mulai mencatat.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {wallets.map((wallet) => (
              <WalletRowItem
                hidden={hidden}
                key={wallet.id}
                wallet={wallet}
                onDelete={() => deleteWallet(wallet.id)}
                onEdit={() => openEdit(wallet)}
              />
            ))}
          </ul>
        )}

      </section>

      {formOpen ? (
        <section
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="animate-sheet-up w-full max-w-md rounded-t-3xl bg-surface pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-lift md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Drag handle for the mobile sheet feel. */}
            <div className="flex justify-center pt-3">
              <span className="h-1.5 w-10 rounded-full bg-outline" aria-hidden="true" />
            </div>

            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="text-lg font-bold text-ink">{editingId ? "Edit Dompet" : "Tambah Dompet"}</h2>
              <button className="flex size-9 items-center justify-center rounded-full bg-surface-container text-muted active:scale-95" onClick={() => setFormOpen(false)} type="button" aria-label="Tutup form dompet">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[72dvh] space-y-3 overflow-y-auto px-5 pt-2">
              {/* Compact preview strip (full card is shown on the dashboard). */}
              <div
                className="flex items-center gap-3 rounded-2xl p-4 text-white shadow-card"
                style={{ background: `linear-gradient(135deg, ${form.color ?? "#1668DC"}, #213145)` }}
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/15">
                  {(() => {
                    const PreviewIcon = ROW_ICONS[form.icon ?? "wallet"] ?? Wallet;
                    return <PreviewIcon size={18} />;
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {form.name?.trim() || form.institution_name?.trim() || "Dompet Baru"}
                  </p>
                  <p className="text-xs text-white/75">{TYPE_LABELS[form.type ?? "cash"]}</p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">
                  {formatCurrency(form.opening_balance_minor ?? 0, "IDR")}
                </p>
              </div>

              <Input label="Nama" value={form.name ?? ""} onChange={(value) => setForm((current) => ({ ...current, name: value }))} error={errors.name} />


              <div className="block">
                <span className="text-sm font-semibold text-muted">Tipe</span>
                <SelectMenu
                  ariaLabel="Tipe dompet"
                  value={form.type ?? "cash"}
                  onChange={(value) => changeType(value as WalletType)}
                  options={(Object.keys(TYPE_LABELS) as WalletType[]).map((value) => ({
                    value,
                    label: TYPE_LABELS[value]
                  }))}
                />
              </div>

              {form.type === "ewallet" || form.type === "bank" ? (
                <div className="block">
                  <span className="text-sm font-semibold text-muted">
                    {form.type === "ewallet" ? "Pilih E-Wallet" : "Pilih Bank"}
                  </span>
                  <SelectMenu
                    ariaLabel={form.type === "ewallet" ? "Pilih e-wallet" : "Pilih bank"}
                    value={manualProvider ? "__manual__" : form.institution_name ?? ""}
                    onChange={(value) => {
                      if (value === "__manual__") {
                        setManualProvider(true);
                        setForm((current) => ({ ...current, institution_name: "" }));
                        return;
                      }
                      setManualProvider(false);
                      changeProvider(value);
                    }}
                    placeholder={form.type === "ewallet" ? "— Pilih e-wallet —" : "— Pilih bank —"}
                    options={[
                      ...(getProvidersForType(form.type ?? "cash") ?? []).map((provider) => ({
                        value: provider.name,
                        label: provider.name,
                        icon: <span className="size-3 rounded-full" style={{ backgroundColor: provider.color }} />
                      })),
                      { value: "__manual__", label: "Manual / Lainnya" }
                    ]}
                  />
                  {manualProvider ? (
                    <div className="mt-3 space-y-3 rounded-xl bg-surface-container/60 p-3">
                      <Input
                        label={form.type === "ewallet" ? "Nama E-Wallet" : "Nama Bank"}
                        value={form.institution_name ?? ""}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            institution_name: value,
                            name: current.name?.trim() ? current.name : value
                          }))
                        }
                      />
                      <label className="block">
                        <span className="text-sm font-semibold text-muted">Warna kartu</span>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            aria-label="Pilih warna kartu"
                            className="h-12 w-14 shrink-0 cursor-pointer rounded-lg border border-outline bg-surface"
                            type="color"
                            value={/^#[0-9A-Fa-f]{6}$/.test(form.color ?? "") ? form.color ?? "#1668DC" : "#1668DC"}
                            onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                          />
                          <input
                            className="min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
                            value={form.color ?? "#1668DC"}
                            onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                            placeholder="#1668DC"
                          />
                        </div>
                      </label>
                    </div>
                  ) : (
                    <span className="mt-1 block text-xs text-muted">
                      Warna kartu otomatis mengikuti brand yang dipilih.
                    </span>
                  )}
                </div>
              ) : null}



              {form.type === "ewallet" ? (
                <Input label="Nomor HP" value={form.phone_number ?? ""} onChange={(value) => setForm((current) => ({ ...current, phone_number: value }))} error={errors.phone_number} inputMode="tel" />
              ) : null}
              {form.type === "bank" ? (
                <Input label="Nomor Rekening" value={form.account_number ?? ""} onChange={(value) => setForm((current) => ({ ...current, account_number: value }))} error={errors.account_number} inputMode="numeric" />
              ) : null}

              <Input label="Saldo Awal (Rp)" value={String(form.opening_balance_minor ?? 0)} onChange={(value) => setForm((current) => ({ ...current, opening_balance_minor: Number(value) || 0 }))} error={errors.opening_balance_minor} inputMode="numeric" />

              <label className="block">
                <span className="text-sm font-semibold text-muted">Mata Uang</span>
                <input
                  className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface-container px-3 text-muted focus:outline-none"
                  value="IDR — Rupiah"
                  readOnly
                />
              </label>

              {errors.form ? <p className="text-sm font-semibold text-error">{errors.form}</p> : null}

              <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60" onClick={saveWallet} type="button" disabled={saving}>
                <Save size={18} />
                {saving ? "Menyimpan..." : "Simpan Dompet"}
              </button>
            </div>

          </div>
        </section>
      ) : null}
    </div>
  );
}


/** Minimal list row for a wallet (full card visual lives on the dashboard). */
function WalletRowItem({
  wallet,
  hidden,
  onEdit,
  onDelete
}: {
  wallet: WalletRow;
  hidden: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = ROW_ICONS[wallet.icon] ?? Wallet;
  const subtitle = wallet.institution_name || TYPE_LABELS[wallet.type];
  const balanceText = formatCurrency(wallet.balance_minor, "IDR");

  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-card">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: wallet.color }}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-ink">{wallet.name}</p>
          {wallet.is_shared ? <UsersRound size={14} className="shrink-0 text-muted" aria-label="Dompet bersama" /> : null}
        </div>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      <p className="shrink-0 text-sm font-bold tabular-nums text-ink">
        {hidden ? "•".repeat(Math.min(balanceText.length, 8)) : balanceText}
      </p>
      <div className="ml-1 flex shrink-0 items-center gap-1">
        <button
          className="flex size-9 items-center justify-center rounded-full text-muted active:bg-surface-container"
          onClick={onEdit}
          type="button"
          aria-label={`Edit ${wallet.name}`}
        >
          <Pencil size={16} />
        </button>
        <button
          className="flex size-9 items-center justify-center rounded-full text-error active:bg-error-container"
          onClick={onDelete}
          type="button"
          aria-label={`Hapus ${wallet.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
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
