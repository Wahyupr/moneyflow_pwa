"use client";

import { Camera, FileCheck2, Landmark, QrCode, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import type { DocumentType } from "@/lib/types";

const options: Array<{ type: DocumentType; label: string; icon: typeof QrCode }> = [
  { type: "qris", label: "QRIS", icon: QrCode },
  { type: "bank_transfer", label: "Bank", icon: Landmark },
  { type: "ewallet_transfer", label: "E-wallet", icon: Smartphone },
  { type: "receipt", label: "Struk", icon: FileCheck2 }
];

export function UploadPanel() {
  const [selected, setSelected] = useState<DocumentType>("qris");
  const selectedLabel = useMemo(() => options.find((item) => item.type === selected)?.label ?? "Bukti", [selected]);

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.05em] text-muted">Upload evidence</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{selectedLabel}</h2>
        </div>
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-white">
          <Camera aria-hidden="true" size={22} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const active = selected === option.type;

          return (
            <button
              aria-pressed={active}
              className={`min-h-12 rounded-lg border px-2 text-xs transition ${
                active ? "border-primary bg-primary text-white shadow-card" : "border-surface-container bg-surface-low text-muted active:bg-surface-container"
              }`}
              key={option.type}
              onClick={() => setSelected(option.type)}
              type="button"
            >
              <Icon aria-hidden="true" className="mx-auto mb-1" size={16} />
              {option.label}
            </button>
          );
        })}
      </div>
      <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-warning bg-[#fff7e6] px-4 text-center text-sm text-muted transition active:bg-[#ffefc2]">
        <Camera aria-hidden="true" className="mb-2 text-warning" size={22} />
        <span>Pilih screenshot atau foto</span>
        <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" />
      </label>
      <div className="mt-3 rounded-lg border border-dashed border-warning bg-[#fff7e6] p-3 text-xs text-[#6f4b00]">
        Draft AI wajib direview sebelum tersimpan sebagai transaksi.
      </div>
    </section>
  );
}
