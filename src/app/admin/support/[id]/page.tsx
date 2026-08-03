"use client";

import { ArrowLeft, Clock, CheckCircle2, AlertCircle, XCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type Ticket = {
  id: string;
  user_id: string;
  user_email: string;
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
  in_progress: "Diproses",
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

const ALL_STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

export default function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    params.then(({ id }) => setTicketId(id));
  }, [params]);

  useEffect(() => {
    if (!ticketId) return;
    fetchTicket(ticketId);
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchTicket(id: string) {
    try {
      const res = await fetch(`/api/support/tickets/${id}`);
      if (!res.ok) { router.push("/admin/support"); return; }
      const json = await res.json();
      setTicket(json.ticket);
      setMessages(json.messages);
    } finally {
      setLoading(false);
    }
  }

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

  async function handleStatusChange(status: TicketStatus) {
    if (!ticketId || !ticket) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTicket({ ...ticket, status });
      }
    } finally {
      setUpdatingStatus(false);
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
    <AppFrame title={ticket.subject} subtitle={ticket.user_email}>
      <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/support")}
          className="flex size-9 items-center justify-center rounded-xl border border-outline transition hover:bg-surface-low"
        >
          <ArrowLeft size={16} />
        </button>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[ticket.status]}`}>
          <StatusIcon size={11} />
          {STATUS_LABEL[ticket.status]}
        </span>
      </div>

      {/* Status update */}
      <div className="mb-5 rounded-2xl border border-outline bg-surface p-4">
        <p className="mb-2.5 text-xs font-semibold text-muted">Update Status</p>
        <div className="flex flex-wrap gap-2">
          {ALL_STATUSES.map((s) => {
            const Icon = STATUS_ICON[s];
            return (
              <button
                key={s}
                type="button"
                disabled={updatingStatus || ticket.status === s}
                onClick={() => handleStatusChange(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                  ticket.status === s
                    ? STATUS_COLOR[s] + " ring-2 ring-current ring-offset-1"
                    : "border border-outline text-muted hover:bg-surface-low"
                }`}
              >
                <Icon size={11} />
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="mb-4 flex-1 space-y-3">
        {messages.map((msg) => {
          const isStaff = msg.sender_role === "admin" || msg.sender_role === "cs";
          return (
            <div key={msg.id} className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isStaff ? "bg-primary text-white" : "bg-surface border border-outline"}`}>
                <p className={`mb-1 text-[11px] font-semibold ${isStaff ? "text-white/70" : "text-muted"}`}>
                  {isStaff ? (msg.sender_display_name ?? "Tim Support") : msg.sender_email}
                </p>
                <p className={`text-sm leading-relaxed ${isStaff ? "text-white" : "text-ink"}`}>{msg.body}</p>
                <p className={`mt-1.5 text-[10px] ${isStaff ? "text-white/50" : "text-muted/60"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {ticket.status !== "closed" && (
        <form onSubmit={handleReply} className="flex gap-2">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Tulis balasan..."
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
