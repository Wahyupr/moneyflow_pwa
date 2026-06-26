"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { formatCurrency } from "@/lib/money";

type Preview = {
  transaction_type: "expense" | "income";
  amount_minor: number;
  description: string;
  wallet_name: string | null;
  category_name: string | null;
};

type BotMsg = {
  role: "bot";
  text: string;
  preview?: Preview;
  saved?: boolean;
  error?: string;
};
type UserMsg = { role: "user"; text: string };
type Message = UserMsg | BotMsg;

const SUGGESTIONS = [
  "Kopi 25rb gopay",
  "Makan siang 35rb OVO",
  "Bensin 50rb cash",
  "Gaji 5 juta",
];

const WELCOME: BotMsg = {
  role: "bot",
  text: "Halo! Saya asisten keuangan kamu. Ketik transaksi dalam bahasa natural, misalnya:\n\"beli kopi 25rb gopay\" atau \"terima gaji 5 juta\"",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json() as { reply?: string; preview?: Preview; error?: string };
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: data.reply ?? data.error ?? "Terjadi kesalahan.", preview: data.preview },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Koneksi gagal, coba lagi." }]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmSave(msgIndex: number, preview: Preview) {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, text: "Menyimpan..." } : m))
    );
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, preview }),
      });
      const data = await res.json() as { saved?: boolean; error?: string };
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? { ...m, text: data.saved ? "Transaksi berhasil disimpan!" : (data.error ?? "Gagal menyimpan."), saved: data.saved, preview: undefined }
            : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, text: "Gagal menyimpan." } : m))
      );
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka chat asisten"
          className="fixed bottom-24 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90 active:scale-95 lg:bottom-8 lg:right-8"
        >
          <MessageCircle size={24} aria-hidden="true" />
        </button>
      )}

      {/* Chat popup */}
      {open && (
        <div
          role="dialog"
          aria-label="Chat asisten keuangan"
          className="fixed bottom-0 right-0 z-50 flex h-[calc(100dvh-0px)] w-full flex-col bg-background shadow-2xl sm:bottom-6 sm:right-6 sm:h-[520px] sm:w-[360px] sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-primary px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <Bot size={20} aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">Asisten Keuangan</p>
                <p className="text-[10px] opacity-80">Catat transaksi dengan bahasa natural</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup chat"
              className="flex size-8 items-center justify-center rounded-full text-white/80 hover:bg-white/20"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "bot" && (
                  <div className="mr-2 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles size={14} aria-hidden="true" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-tr-sm bg-primary text-white"
                    : "rounded-tl-sm bg-surface-container text-ink"
                }`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.role === "bot" && (msg as BotMsg).preview && !((msg as BotMsg).saved) && (
                    <div className="mt-2 rounded-lg border border-surface-low bg-background p-2 text-xs">
                      <p className="font-bold text-ink">{(msg as BotMsg).preview!.description}</p>
                      <p className={`font-semibold ${(msg as BotMsg).preview!.transaction_type === "income" ? "text-green-600" : "text-red-500"}`}>
                        {(msg as BotMsg).preview!.transaction_type === "income" ? "+" : "-"}
                        {formatCurrency((msg as BotMsg).preview!.amount_minor, "IDR")}
                      </p>
                      {(msg as BotMsg).preview!.wallet_name && (
                        <p className="text-muted">{(msg as BotMsg).preview!.wallet_name} · {(msg as BotMsg).preview!.category_name ?? "Umum"}</p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => confirmSave(idx, (msg as BotMsg).preview!)}
                          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white active:scale-95"
                        >
                          <CheckCircle size={12} /> Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => setMessages((prev) => prev.map((m, i) => i === idx ? { ...m, preview: undefined } : m))}
                          className="rounded-lg bg-surface-low px-3 py-1.5 text-xs font-bold text-muted active:scale-95"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                  {msg.role === "bot" && (msg as BotMsg).saved && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle size={12} /> Tersimpan
                    </span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="mr-2 mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles size={14} />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-surface-container px-3 py-2">
                  <div className="flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions — shown only when just the welcome message */}
          {messages.length === 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="shrink-0 rounded-full border border-surface-container bg-surface px-3 py-1.5 text-xs font-medium text-ink active:scale-95"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); void send(input); }}
            className="flex items-center gap-2 border-t border-surface-container p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik transaksi..."
              disabled={loading}
              aria-label="Pesan"
              className="min-h-10 flex-1 rounded-xl border border-surface-container bg-surface-low px-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Kirim"
              className="flex size-10 items-center justify-center rounded-xl bg-primary text-white transition active:scale-95 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
