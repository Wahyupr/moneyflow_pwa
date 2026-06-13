"use client";

import { Mic, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function VoiceInputPage() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("Sedang Mendengarkan...");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)
        : undefined;

    if (!SpeechRecognitionCtor) {
      setTranscript("Beli kopi 21 rb di Kopi Kenangan pakai GoPay");
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
    if (!recognitionRef.current) {
      setTranscript("Beli kopi 21 rb di Kopi Kenangan pakai GoPay");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    setListening(true);
    recognitionRef.current.start();
  }

  async function reviewDraft() {
    const cleanTranscript = transcript === "Sedang Mendengarkan..." ? "Beli kopi 21 rb di Kopi Kenangan pakai GoPay" : transcript;
    localStorage.setItem("voice_draft_preview", cleanTranscript);

    const response = await fetch("/api/voice-drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: cleanTranscript, occurred_at: new Date().toISOString() })
    }).catch(() => null);

    if (response?.ok) {
      const json = await response.json();
      window.location.href = `/ai-transaction-review?draft=${json.draft.id}`;
      return;
    }

    window.location.href = "/ai-transaction-review?source=voice";
  }

  return (
    <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden bg-background px-5 py-8 text-ink">
      <div className="flex justify-end">
        <Link className="flex size-12 items-center justify-center rounded-full bg-surface-container text-ink shadow-card active:scale-95" href="/dashboard" aria-label="Close voice input">
          <X size={22} />
        </Link>
      </div>

      <section className="-mt-12 flex flex-1 flex-col items-center justify-center">
        <div className="relative mb-14 flex items-center justify-center">
          <div className={`absolute size-24 rounded-full bg-income/20 ${listening ? "animate-ping" : ""}`} />
          <button className="relative z-10 flex size-24 items-center justify-center rounded-full bg-income text-white shadow-[0_8px_32px_rgba(16,185,129,0.3)] active:scale-95" onClick={toggleListening} type="button">
            <Mic size={40} fill="currentColor" />
          </button>
        </div>
        <div className="mb-8 flex h-12 items-end justify-center gap-1.5 opacity-80">
          {[36, 22, 30, 42, 18, 34, 24].map((height, index) => (
            <span className={`w-1.5 rounded-full bg-income ${listening ? "animate-pulse" : ""}`} key={index} style={{ height }} />
          ))}
        </div>
        <textarea
          className="min-h-28 w-full max-w-sm resize-none rounded-xl border-0 bg-transparent p-2 text-center text-xl font-bold leading-8 text-ink outline-none focus:ring-0"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
        />
      </section>

      <section className="pb-8 text-center">
        <div className="mb-4 rounded-xl border border-surface-container bg-surface p-4 shadow-card">
          <p className="text-sm text-muted">Ucapkan transaksi Anda, misal:</p>
          <p className="mt-1 font-semibold">"Makan siang 50 ribu pakai GoPay"</p>
        </div>
        <button className="min-h-12 w-full max-w-sm rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={reviewDraft} type="button">
          Review Draft
        </button>
      </section>
    </main>
  );
}
