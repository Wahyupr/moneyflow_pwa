"use client";

import { Check, Mic, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/money";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type VoicePreview = {
  transaction_type: "expense" | "income";
  amount_minor: number;
  description: string;
  wallet_id: string | null;
  wallet_name: string | null;
  category_id: string | null;
  category_name: string | null;
  used_ai: boolean;
};

export default function VoiceInputPage() {
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [preview, setPreview] = useState<VoicePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)
        : undefined;

    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "id-ID";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1]?.[0]?.transcript;
      if (latest) {
        setTranscript(latest);
      }
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  function toggleListening() {
    setError(null);
    setPreview(null);
    if (!recognitionRef.current) {
      setError("Browser tidak mendukung input suara. Coba gunakan Chrome.");

      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    setTranscript("");
    setListening(true);
    recognitionRef.current.start();
  }

  // Preview-only call: parses (rules + AI fallback) and matches wallet/category
  // without saving, so the user can confirm.
  async function analyze() {
    const text = transcript.trim();
    if (!text) {
      setError("Ucapkan atau ketik transaksi dulu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/voice-transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text, commit: false })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Gagal memproses suara.");
        return;
      }
      setPreview(payload.preview as VoicePreview);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const text = transcript.trim();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/voice-transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text, occurred_at: new Date().toISOString() })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Gagal menyimpan transaksi.");
        return;
      }
      router.push("/transactions");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-background px-5 py-8 text-ink">
      <div className="relative z-20 flex justify-end">
        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-full bg-surface-container text-ink shadow-card active:scale-95"
          aria-label="Tutup input suara"
          onClick={() => {
            recognitionRef.current?.stop();
            router.push("/dashboard");
          }}
        >
          <X size={22} />
        </button>
      </div>


      <section className="-mt-12 flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-10 flex items-center justify-center">
          <div className={`absolute size-24 rounded-full bg-income/20 ${listening ? "animate-ping" : ""}`} />
          <button className="relative z-10 flex size-24 items-center justify-center rounded-full bg-income text-white shadow-[0_8px_32px_rgba(16,185,129,0.3)] active:scale-95" onClick={toggleListening} type="button">
            <Mic size={40} fill="currentColor" />
          </button>
        </div>

        <div className="flex min-h-24 w-full max-w-sm items-center justify-center rounded-xl border border-outline bg-surface p-3 text-center text-lg font-semibold leading-7 text-ink">
          {transcript ? (
            transcript
          ) : (
            <span className="text-muted">{listening ? "Sedang mendengarkan..." : "Tekan mic lalu ucapkan transaksi"}</span>
          )}
        </div>


        {preview ? (
          <div className="mt-4 w-full max-w-sm rounded-xl border border-outline bg-surface p-4 text-left shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink">Hasil deteksi</h3>
              {preview.used_ai ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-1 text-[11px] font-bold text-secondary">
                  <Sparkles size={12} /> AI
                </span>
              ) : (
                <span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-bold text-muted">Otomatis</span>
              )}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Nominal" value={formatCurrency(preview.amount_minor, "IDR")} />
              <Row label="Tipe" value={preview.transaction_type === "income" ? "Pemasukan" : "Pengeluaran"} />
              <Row label="Deskripsi" value={preview.description || "-"} />
              <Row label="Dompet" value={preview.wallet_name ?? "Tidak ditemukan"} />
              <Row label="Kategori" value={preview.category_name ?? "Tanpa kategori"} />
            </dl>
          </div>
        ) : null}

        {error ? <p className="mt-3 max-w-sm text-center text-sm font-semibold text-error">{error}</p> : null}
      </section>

      <section className="pb-6">
        {preview ? (
          <div className="mx-auto flex w-full max-w-sm gap-2">
            <button className="min-h-12 flex-1 rounded-lg bg-surface-container px-4 font-bold text-primary active:scale-[0.98]" onClick={() => setPreview(null)} type="button" disabled={busy}>
              Ulangi
            </button>
            <button className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60" onClick={save} type="button" disabled={busy}>
              <Check size={18} />
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        ) : (
          <button className="mx-auto block min-h-12 w-full max-w-sm rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98] disabled:opacity-60" onClick={analyze} type="button" disabled={busy}>
            {busy ? "Memproses..." : "Proses Transaksi"}
          </button>
        )}
        <p className="mt-3 text-center text-xs text-muted">Contoh: &ldquo;Makan siang 50 ribu pakai GoPay&rdquo;. Tanpa sebut dompet = Cash.</p>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-semibold text-ink">{value}</dd>
    </div>
  );
}
