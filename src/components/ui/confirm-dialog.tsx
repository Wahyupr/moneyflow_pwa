"use client";

import { AlertTriangle, X } from "lucide-react";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

/**
 * Custom confirmation dialog — replaces browser's window.confirm() with a
 * styled modal that matches the app's design system.
 *
 * Usage:
 *   const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
 *
 *   // trigger:
 *   setConfirmState({ title: "Hapus?", message: "...", onConfirm: () => doDelete() });
 *
 *   // render:
 *   {confirmState && (
 *     <ConfirmDialog {...confirmState} onCancel={() => setConfirmState(null)} />
 *   )}
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Ya, Hapus",
  onConfirm,
  onCancel,
  danger = true
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-t-2xl bg-surface p-5 shadow-lift sm:rounded-2xl">
        <div className="flex items-start gap-3">
          {danger ? (
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-expense/10 text-expense">
              <AlertTriangle size={18} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-container"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-surface-container px-4 py-3 text-sm font-bold text-ink active:scale-[0.98]"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onCancel(); }}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold text-white active:scale-[0.98] ${
              danger ? "bg-expense" : "bg-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ConfirmState = Omit<ConfirmDialogProps, "onCancel">;
