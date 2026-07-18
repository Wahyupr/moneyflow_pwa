"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle, Crown, MessageCircle, Send, Sparkles, X, Zap } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/money";

/** Renders a subset of markdown: headings, bold, bullet lists, numbered lists, horizontal rules. */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      elements.push(<hr key={key++} className="my-2 border-surface-low" />);
      i++;
      continue;
    }

    // Headings (## or ###)
    if (/^#{1,3}\s/.test(trimmed)) {
      const level = (trimmed.match(/^(#+)/)?.[1].length ?? 1);
      const content = trimmed.replace(/^#+\s/, "");
      if (level === 1) {
        elements.push(<p key={key++} className="mt-1 font-bold text-ink">{renderInline(content)}</p>);
      } else if (level === 2) {
        elements.push(<p key={key++} className="mt-1 font-semibold text-ink">{renderInline(content)}</p>);
      } else {
        elements.push(<p key={key++} className="mt-0.5 font-medium text-ink/80">{renderInline(content)}</p>);
      }
      i++;
      continue;
    }

    // Bullet list item (• or - or *)
    if (/^[•\-\*]\s/.test(trimmed)) {
      const bulletItems: string[] = [];
      while (i < lines.length && /^[•\-\*]\s/.test(lines[i].trim())) {
        bulletItems.push(lines[i].trim().replace(/^[•\-\*]\s/, ""));
        i++;
        // skip a single blank separator line between bullet blocks but continue collecting
        if (i < lines.length && lines[i].trim() === "" && i + 1 < lines.length && /^[•\-\*]\s/.test(lines[i + 1].trim())) {
          i++;
        }
      }
      elements.push(
        <ul key={key++} className="my-0.5 space-y-0.5 pl-1">
          {bulletItems.map((item, j) => (
            <li key={j} className="flex gap-1.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list — collect ALL numbered items including across blank-line breaks
    if (/^\d+\.\s/.test(trimmed)) {
      const numItems: string[] = [];
      while (i < lines.length) {
        if (/^\d+\.\s/.test(lines[i].trim())) {
          numItems.push(lines[i].trim().replace(/^\d+\.\s/, ""));
          i++;
        } else if (lines[i].trim() === "" && i + 1 < lines.length && /^\d+\.\s/.test(lines[i + 1].trim())) {
          // blank line between numbered items — skip and keep collecting
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ol key={key++} className="my-0.5 list-decimal space-y-0.5 pl-4">
          {numItems.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line → small gap
    if (trimmed === "") {
      elements.push(<div key={key++} className="h-1" />);
      i++;
      continue;
    }

    // Normal paragraph line
    elements.push(
      <p key={key++} className="leading-snug">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5 text-sm">{elements}</div>;
}

/** Renders inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode {
  // Split on **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="rounded bg-surface-low px-1 font-mono text-xs">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

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
  /** Original user message — needed to re-send with commit:true */
  originalMessage?: string;
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
  text: "Halo! Saya asisten keuangan kamu 💰\n\nCatat transaksi atau tanya seputar keuangan kamu.\n\nContoh:\n• \"beli kopi 25rb gopay\"\n• \"bagaimana cara menabung lebih efektif?\"\n• \"analisis pengeluaran bulan ini\"",
};

// Minimal plan check — fetched once per widget mount
type PlanInfo = { plan: string };

function ProUpgradeWall({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
        <Zap size={28} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-base font-extrabold text-ink">Fitur Pro</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          AI Asisten Chat interaktif hanya tersedia di paket Pro. Tanya apa saja seputar keuangan, budgeting, hingga solusi finansial.
        </p>
      </div>
      <div className="w-full space-y-2">
        <Link
          href="/pricing"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-sm font-bold text-white shadow-card transition hover:brightness-110 active:scale-[0.98]"
          onClick={onClose}
        >
          <Crown size={15} />
          Upgrade ke Pro
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-10 w-full items-center justify-center rounded-xl border border-outline text-sm font-semibold text-muted transition hover:bg-surface-low active:scale-[0.98]"
        >
          Nanti saja
        </button>
      </div>
    </div>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch plan once when widget mounts
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: (PlanInfo & { entitlement?: { plan?: string } }) | null) => {
        // /api/profile returns plan nested under entitlement
        const p = (json as { entitlement?: { plan?: string } } | null)?.entitlement?.plan ?? "free";
        setPlan(p);
      })
      .catch(() => setPlan("free"));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isPro = plan === "pro";

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
        body: JSON.stringify({ message: trimmed, commit: false }),
      });
      const data = await res.json() as { reply?: string; preview?: Preview; error?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.preview
            ? "Transaksi terdeteksi, konfirmasi untuk menyimpan:"
            : (data.reply ?? data.error ?? "Terjadi kesalahan."),
          preview: data.preview,
          originalMessage: trimmed,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Koneksi gagal, coba lagi." }]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmSave(msgIndex: number) {
    const msg = messages[msgIndex] as BotMsg;
    const originalMessage = msg.originalMessage;
    if (!originalMessage) return;

    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, text: "Menyimpan...", preview: undefined } : m))
    );
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: originalMessage }),
      });
      const data = await res.json() as { transaction?: unknown; error?: string };
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? {
                ...m,
                text: data.transaction ? "Transaksi berhasil disimpan!" : (data.error ?? "Gagal menyimpan."),
                saved: !!data.transaction,
              }
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
          suppressHydrationWarning
          className="fixed bottom-[calc(3.5rem+max(env(safe-area-inset-bottom),0.5rem)+0.75rem)] right-4 z-[60] flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90 active:scale-95 md:bottom-6 md:right-6 lg:bottom-8 lg:right-8"
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
                <p className="text-[10px] opacity-80">
                  {isPro ? "Pro · Tanya apa saja tentang keuangan" : "Catat transaksi dengan bahasa natural"}
                </p>
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

          {/* Pro upgrade wall — shown only for non-pro users */}
          {plan !== null && !isPro ? (
            <ProUpgradeWall onClose={() => setOpen(false)} />
          ) : (
            <>
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
                      {msg.role === "user"
                        ? <p className="whitespace-pre-wrap">{msg.text}</p>
                        : <MarkdownText text={msg.text} />
                      }
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
                              onClick={() => confirmSave(idx)}
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
                  placeholder={isPro ? "Ketik transaksi atau pertanyaan..." : "Ketik transaksi..."}
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
            </>
          )}
        </div>
      )}
    </>
  );
}
