"use client";

import { ArrowLeft, Clock, CheckCircle2, AlertCircle, XCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  sender_id: string;
  sender_email: string;
  sender_display_name: string | null;
  sender_role: string;
  body: string;
  created_at: string;
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Terbuka",
  in_progress: "Sedang Diproses",
  resolved: "Selesai",
  closed: "Ditutup",
};

const STATUS_COLOR: Record<TicketStatus, string> = {
  open: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "bg-income/10 text-income",
  closed: "bg-muted/20 text-muted",
};

const STATUS_ICON: Record<TicketStatus, React.ElementType> = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: XCircle,
};

export default function SupportTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then(({ id }) => setTicketId(id));
  }, [params]);

  useEffect(() => {
    if (!ticketId) return;
    Promise.all([
      fetch(`/api/support/tickets/${ticketId}`).then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]).then(([ticketData, profileData]) => {
      setTicket(ticketData.ticket);
      setMessages(ticketData.messages);
      setCurrentUserId(profileData.user?.id ?? null);
    }).finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !ticketId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: replyBody.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [...prev, json.message as Message]);
        setReplyBody("");
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <AppFrame>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppFrame>
    );
  }

  if (!ticket) return null;

  const StatusIcon = STATUS_ICON[ticket.status];

  return (
    <AppFrame title={ticket.subject} subtitle="Detail Tiket">
      <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/support")}
          className="flex size-9 items-center justify-center rounded-xl border border-outline transition hover:bg-surface-low"
        >
          <ArrowLeft size={16} />
        </button>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[ticket.status]}`}>
          <StatusIcon size={11} />
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>

      {/* Info closed */}
      {ticket.status === "closed" && (
        <div className="mb-4 rounded-2xl border border-outline bg-surface-low px-4 py-3 text-sm text-muted">
          Tiket ini sudah ditutup. Buat tiket baru jika kamu masih membutuhkan bantuan.
        </div>
      )}

      {/* Chat area */}
      <div className="mb-4 flex-1 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          const isStaff = msg.sender_role === "admin" || msg.sender_role === "cs";
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMe ? "bg-primary text-white" : "bg-surface border border-outline"}`}>
                {!isMe && (
                  <p className="mb-1 text-[11px] font-semibold text-muted">
                    {isStaff ? "Tim Support MoneyFlow" : (msg.sender_display_name ?? msg.sender_email)}
                  </p>
                )}
                <p className={`text-sm leading-relaxed ${isMe ? "text-white" : "text-ink"}`}>{msg.body}</p>
                <p className={`mt-1.5 text-[10px] ${isMe ? "text-white/50" : "text-muted/60"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {ticket.status !== "closed" && ticket.status !== "resolved" && (
        <form onSubmit={handleReply} className="flex gap-2">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Tulis pesan..."
            rows={2}
            maxLength={5000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(e as unknown as React.FormEvent); }
            }}
            className="min-h-[48px] flex-1 resize-none rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={sending || !replyBody.trim()}
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:brightness-105 disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </form>
      )}
      </div>
    </AppFrame>
  );
}
