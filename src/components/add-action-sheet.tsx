"use client";

import Link from "next/link";
import { FileCheck2, FileImage, Mic, PencilLine, QrCode, ReceiptText, X } from "lucide-react";
import { getAddActionOptions } from "@/lib/app-actions";

const iconMap = {
  voice: Mic,
  manual: PencilLine,
  receipt: ReceiptText,
  transfer_proof: FileImage,
  qris: QrCode,
  ai_review: FileCheck2
};

export function AddActionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-end bg-ink/20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-sm md:items-center md:justify-center" role="dialog" aria-modal="true">
      <section className="mx-auto w-full max-w-md rounded-xl bg-surface p-4 shadow-lift lg:max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Catat Transaksi</h2>
          <button className="flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-container" onClick={onClose} type="button" aria-label="Tutup menu tambah">
            <X size={18} />
          </button>
        </div>
        {/* Mobile: list — Desktop: grid */}
        <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
          {getAddActionOptions().map((action) => {
            const Icon = iconMap[action.id as keyof typeof iconMap] ?? PencilLine;

            return (
              <Link
                className="flex min-h-14 items-center gap-3 rounded-lg bg-surface-low px-4 text-ink active:scale-[0.98] lg:flex-col lg:items-center lg:justify-center lg:gap-2 lg:rounded-xl lg:py-4 lg:text-center"
                href={action.href}
                key={action.id}
                onClick={onClose}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-card lg:size-12">
                  <Icon size={19} />
                </span>
                <span className="font-semibold lg:text-sm">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
