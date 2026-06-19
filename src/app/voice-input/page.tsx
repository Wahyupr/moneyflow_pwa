"use client";

import { Check, Mic, Pencil, Sparkles, Square, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/money";

type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  length: number;
  0: SpeechRecognitionAlternative;
};
type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
};
type SpeechRecognitionErrorLike = { error: string; message?: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
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

const SUGGESTIONS = [
  "Makan siang 50 ribu pakai GoPay",
  "Gaji 5 juta masuk rekening Mandiri",
  "Bensin 100 ribu Shell",
  "Kopi 28 ribu di Janji Jiwa",
  "Bayar listrik 250 ribu"
];

// Auto-stop safety net so we never leave the mic open forever.
const MAX_LISTEN_MS = 60_000;

export default function VoiceInputPage() {
  const router = useRouter();
  const [listening, setListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [preview, setPreview] = useState<VoicePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [seconds, setSeconds] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // True when the USER asked us to stop. Distinguishes intentional stop from
  // the browser auto-ending on silence — we only auto-restart in the latter case.
  const userStoppedRef = useRef(true);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Text finalized in PREVIOUS recognition sessions (a session ends whenever the
  // browser fires onend and we auto-restart). `event.results` resets each session,
  // so we keep prior text here and prepend it.
  const committedRef = useRef("");
  // Final text of the CURRENT session, rebuilt fresh on every onresult event so
  // we never double-append the cumulative results array.
  const sessionFinalRef = useRef("");

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)
        : undefined;

    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    // Bahasa Indonesia. Use id-ID for widest Indonesian vocab support.
    recognition.lang = "id-ID";
    // Continuous = keep transcribing through pauses. This is the BIG sensitivity
    // fix — the old `continuous = false` cut users off mid-sentence.
    recognition.continuous = true;
    // Interim results = live caption as the user speaks, so they can see the
    // transcription in progress and we can keep the final text accumulating.
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setSeconds(0);
      tickTimerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      hardStopTimerRef.current = setTimeout(() => {
        // Force-stop after MAX_LISTEN_MS to avoid infinite listening.
        userStoppedRef.current = true;
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }, MAX_LISTEN_MS);
    };

    recognition.onresult = (event) => {
      // `event.results` is CUMULATIVE for the current session — it already
      // contains every result so far. So we REBUILD the session's final text
      // from scratch each event instead of appending (appending double-counts
      // and produces "...mandiri...mandiri"). Prior sessions live in committedRef.
      let sessionFinal = "";
      let interimChunk = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          sessionFinal += text;
        } else {
          interimChunk += text;
        }
      }
      sessionFinalRef.current = sessionFinal.trim();
      const combined = [committedRef.current, sessionFinalRef.current]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" ");
      setFinalTranscript(combined);
      setInterimTranscript(interimChunk);
    };

    recognition.onerror = (event) => {
      // "aborted"/"no-speech" are benign; surface real errors to the user.
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Akses mikrofon ditolak. Aktifkan izin mic di browser Anda.");
        userStoppedRef.current = true;
      } else {
        setError(`Maaf, input suara bermasalah: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // A session just ended. Fold its final text into committedRef because the
      // next session's `event.results` starts empty — otherwise the restart
      // would wipe what was already said.
      if (sessionFinalRef.current) {
        committedRef.current = [committedRef.current, sessionFinalRef.current]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(" ");
        sessionFinalRef.current = "";
      }
      // Browser ended recognition. If the user didn't ask to stop, restart so
      // long silences or background noise don't prematurely end the session.
      if (!userStoppedRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // fall through to setListening(false)
        }
      }
      setListening(false);
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      if (hardStopTimerRef.current) {
        clearTimeout(hardStopTimerRef.current);
        hardStopTimerRef.current = null;
      }
      // Collapse interim into final when we stop listening so the user can edit
      // a single, unified transcript.
      setFinalTranscript((prev) => {
        const interim = interimTranscriptRef.current;
        if (!interim) return prev;
        return prev ? `${prev} ${interim}`.trim() : interim.trim();
      });
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;

    return () => {
      userStoppedRef.current = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
      if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
    };
  }, []);

  // Keep a live ref of interim so onend can fold it into final without race.
  const interimTranscriptRef = useRef("");
  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    setPreview(null);
    setFinalTranscript("");
    setInterimTranscript("");
    committedRef.current = "";
    sessionFinalRef.current = "";
    userStoppedRef.current = false;
    try {
      recognitionRef.current.start();
    } catch {
      // start() throws if already started — swallow and reset state.
      userStoppedRef.current = true;
    }
  }, []);

  const stopListening = useCallback(() => {
    userStoppedRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  function toggleListening() {
    if (!supported) {
      setError("Browser tidak mendukung input suara. Gunakan Chrome di Android/desktop.");
      return;
    }
    if (listening) stopListening();
    else startListening();
  }

  const displayTranscript = useMemo(() => {
    const base = finalTranscript.trim();
    const interim = interimTranscript.trim();
    if (base && interim) return `${base} ${interim}`;
    return base || interim;
  }, [finalTranscript, interimTranscript]);

  const committedTranscript = useMemo(() => {
    const base = finalTranscript.trim();
    return base || interimTranscript.trim();
  }, [finalTranscript, interimTranscript]);

  async function analyze() {
    const text = committedTranscript.trim();
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
    const text = committedTranscript.trim();
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
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-5 py-6 text-ink">
      {/* Ambient background — soft blobs for depth */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className={`absolute -bottom-40 right-[-6rem] size-[22rem] rounded-full bg-income/10 blur-3xl transition-opacity duration-700 ${listening ? "opacity-100" : "opacity-40"}`} />
        <div className={`absolute -bottom-40 left-[-6rem] size-[22rem] rounded-full bg-secondary/10 blur-3xl transition-opacity duration-700 ${listening ? "opacity-100" : "opacity-40"}`} />
      </div>

      <header className="z-20 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Voice Transaction</p>
          <h1 className="mt-1 text-lg font-bold text-ink">Catat dengan suara</h1>
        </div>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full bg-surface text-ink shadow-card active:scale-95"
          aria-label="Tutup input suara"
          onClick={() => {
            stopListening();
            router.push("/dashboard");
          }}
        >
          <X size={20} />
        </button>
      </header>

      <section className="mt-8 flex flex-1 flex-col items-center justify-center">
        {/* Mic button with layered animations */}
        <div className="relative flex h-56 items-center justify-center">
          {listening ? (
            <>
              <span className="absolute size-56 animate-ping rounded-full bg-primary/10" />
              <span className="absolute size-44 animate-pulse rounded-full bg-primary/15" />
            </>
          ) : null}
          <span
            className={`absolute rounded-full border-2 transition-all duration-500 ${
              listening ? "size-36 border-primary/40" : "size-28 border-outline/50"
            }`}
          />
          <button
            className={`relative z-10 flex size-28 items-center justify-center rounded-full text-white shadow-[0_12px_40px_rgba(22,104,220,0.35)] transition-transform duration-200 active:scale-95 ${
              listening
                ? "bg-gradient-to-br from-expense to-rose-600"
                : "bg-gradient-to-br from-primary to-primary-container"
            }`}
            onClick={toggleListening}
            type="button"
            aria-pressed={listening}
            aria-label={listening ? "Berhenti merekam" : "Mulai merekam"}
          >
            {listening ? <Square size={30} fill="currentColor" /> : <Mic size={34} />}
          </button>
        </div>

        {/* Waveform / status row */}
        <div className="mt-2 flex h-12 items-center justify-center gap-3">
          {listening ? (
            <>
              <Waveform />
              <span className="font-mono text-sm font-semibold text-primary">{formatDuration(seconds)}</span>
            </>
          ) : (
            <p className="text-sm font-semibold text-muted">
              {supported ? "Tekan tombol mic, lalu ucapkan transaksi" : "Browser ini tidak mendukung input suara"}
            </p>
          )}
        </div>

        {/* Transcript bubble */}
        <div className="mt-4 w-full max-w-md">
          <label className="sr-only" htmlFor="voice-transcript">
            Transkrip
          </label>
          <textarea
            id="voice-transcript"
            value={displayTranscript}
            onChange={(e) => {
              setFinalTranscript(e.target.value);
              setInterimTranscript("");
            }}
            placeholder={listening ? "Mendengarkan..." : "Transkrip akan muncul di sini. Anda juga bisa mengetik manual."}
            rows={3}
            className="w-full resize-none rounded-2xl border border-outline bg-surface px-4 py-3 text-base leading-relaxed text-ink shadow-card outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {displayTranscript ? (
            <div className="mt-2 flex items-center justify-between px-1">
              <p className="inline-flex items-center gap-1 text-xs text-muted">
                <Pencil size={11} /> Ketuk untuk edit jika ada kata yang salah
              </p>
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setFinalTranscript("");
                  setInterimTranscript("");
                  setPreview(null);
                  setError(null);
                }}
                className="text-xs font-semibold text-primary active:opacity-70"
              >
                Bersihkan
              </button>
            </div>
          ) : null}
        </div>

        {/* Suggestion chips (only when empty + idle) */}
        {!displayTranscript && !listening ? (
          <div className="mt-5 w-full max-w-md">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Contoh ucapan</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFinalTranscript(s)}
                  className="rounded-full border border-outline bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition active:scale-95 hover:border-primary/40 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Preview card */}
        {preview ? (
          <div className="mt-5 w-full max-w-md overflow-hidden rounded-2xl border border-outline bg-surface shadow-card">
            <div
              className={`flex items-center justify-between px-4 py-3 ${
                preview.transaction_type === "income" ? "bg-income/10" : "bg-expense/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
                    preview.transaction_type === "income" ? "bg-income/20 text-income" : "bg-expense/20 text-expense"
                  }`}
                >
                  {preview.transaction_type === "income" ? "Pemasukan" : "Pengeluaran"}
                </span>
                {preview.used_ai ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-1 text-[11px] font-bold text-secondary">
                    <Sparkles size={11} /> AI
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-container px-2 py-1 text-[11px] font-bold text-muted">
                    Otomatis
                  </span>
                )}
              </div>
              <p className="font-mono text-base font-bold text-ink">
                {formatCurrency(preview.amount_minor, "IDR")}
              </p>
            </div>
            <dl className="space-y-2 px-4 py-3 text-sm">
              <Row label="Deskripsi" value={preview.description || "-"} />
              <Row label="Dompet" value={preview.wallet_name ?? "Tidak ditemukan"} />
              <Row label="Kategori" value={preview.category_name ?? "Tanpa kategori"} />
            </dl>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 max-w-md rounded-lg bg-expense/10 px-4 py-2 text-center text-sm font-semibold text-expense">
            {error}
          </p>
        ) : null}
      </section>

      {/* Bottom action bar */}
      <section className="pb-6 pt-4">
        {preview ? (
          <div className="mx-auto flex w-full max-w-md gap-3">
            <button
              className="min-h-12 flex-1 rounded-xl bg-surface px-4 font-bold text-primary shadow-card active:scale-[0.98]"
              onClick={() => setPreview(null)}
              type="button"
              disabled={busy}
            >
              Ulangi
            </button>
            <button
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 font-bold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
              onClick={save}
              type="button"
              disabled={busy}
            >
              <Check size={18} />
              {busy ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        ) : (
          <button
            className="mx-auto block min-h-12 w-full max-w-md rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 font-bold text-white shadow-card active:scale-[0.98] disabled:opacity-60"
            onClick={analyze}
            type="button"
            disabled={busy || !committedTranscript.trim()}
          >
            {busy ? "Memproses..." : "Proses Transaksi"}
          </button>
        )}
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Waveform() {
  // 7 bars with staggered animation delays. Keyframes live in globals.css so
  // they don't leak into the flex layout (inline <style> would render as a
  // flex item and add unwanted spacing).
  const bars = [12, 22, 16, 28, 18, 24, 10];
  return (
    <div className="flex h-9 items-center justify-center gap-1" aria-hidden="true">
      {bars.map((h, idx) => (
        <span
          key={idx}
          className="w-1 origin-center rounded-full bg-primary"
          style={{
            height: `${h}px`,
            animation: `voice-bar 900ms ease-in-out ${idx * 90}ms infinite alternate`
          }}
        />
      ))}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
