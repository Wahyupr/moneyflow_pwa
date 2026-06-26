"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

interface GoogleTermsModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function GoogleTermsModal({ onConfirm, onCancel, loading = false }: GoogleTermsModalProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-terms-title"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-sm rounded-t-3xl bg-surface p-6 shadow-lift sm:rounded-3xl">
        <button
          aria-label="Tutup"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full text-muted hover:bg-surface-container"
          onClick={onCancel}
          type="button"
        >
          <X size={18} />
        </button>

        {/* Google mark */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-outline bg-white shadow-card">
            <GoogleMark />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Lanjutkan dengan Google</p>
            <p className="text-xs text-muted">Login atau buat akun baru</p>
          </div>
        </div>

        <p id="google-terms-title" className="text-base font-bold text-ink">
          Sebelum melanjutkan
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Dengan masuk menggunakan Google, kamu menyetujui{" "}
          <a
            className="font-semibold text-primary hover:underline"
            href="/syarat-ketentuan"
            target="_blank"
            rel="noopener noreferrer"
          >
            Syarat &amp; Ketentuan
          </a>{" "}
          dan{" "}
          <a
            className="font-semibold text-primary hover:underline"
            href="/kebijakan-refund"
            target="_blank"
            rel="noopener noreferrer"
          >
            Kebijakan Layanan
          </a>{" "}
          MoneyFlow, termasuk <strong>kebijakan no-refund</strong> untuk pembelian langganan Premium.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-outline bg-surface-low p-3 text-sm">
          <input
            aria-describedby="terms-description"
            checked={accepted}
            className="mt-0.5 size-4 rounded border-outline text-primary focus:ring-primary"
            onChange={(e) => setAccepted(e.target.checked)}
            type="checkbox"
          />
          <span id="terms-description" className="leading-5 text-ink">
            Saya telah membaca dan menyetujui Syarat &amp; Ketentuan serta Kebijakan Layanan MoneyFlow.
          </span>
        </label>

        <div className="mt-5 flex flex-col gap-2">
          <button
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-white shadow-card transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!accepted || loading}
            onClick={onConfirm}
            type="button"
          >
            {loading ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" size={18} />
                Menghubungkan…
              </>
            ) : (
              <>
                <GoogleMark />
                Setuju &amp; Lanjutkan dengan Google
              </>
            )}
          </button>
          <button
            className="min-h-11 w-full rounded-xl text-sm font-semibold text-muted transition hover:bg-surface-container active:scale-[0.98]"
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
