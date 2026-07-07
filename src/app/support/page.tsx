"use client";

import { ArrowRight, MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  message_count: string;
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

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    try {
      const res = await fetch("/api/support/tickets");
      if (res.ok) {
        const json = await res.json();
        setTickets(json.tickets ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Gagal membuat tiket.");
        return;
      }
      const json = await res.json();
      setShowForm(false);
      setSubject("");
      setBody("");
      router.push(`/support/${json.ticket.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppFrame title="Bantuan & Support" subtitle="Kirim keluhan atau pertanyaan ke tim kami">
      <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div />
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 active:scale-[0.98]"
        >
          <Plus size={16} />
          Buat Tiket
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl border border-outline bg-surface p-5 shadow-card"
        >
          <h2 className="mb-4 text-sm font-bold text-ink">Tiket Baru</h2>
          <div className="mb-3">
            <label className="mb-1.5 block text-xs font-semibold text-muted">Subjek</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ringkasan masalah kamu..."
              maxLength={200}
              required
              className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-semibold text-muted">Pesan</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Jelaskan masalah kamu secara detail..."
              rows={4}
              maxLength={5000}
              required
              className="w-full resize-none rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && <p className="mb-3 text-xs text-expense">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {submitting ? "Mengirim..." : "Kirim Tiket"}
              {!submitting && <ArrowRight size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-outline px-4 py-2 text-sm font-semibold text-muted transition hover:bg-surface-low"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-outline bg-surface py-16 text-center">
          <MessageSquare size={36} className="mb-3 text-muted/40" />
          <p className="text-sm font-semibold text-ink">Belum ada tiket</p>
          <p className="mt-1 text-xs text-muted">Buat tiket baru jika kamu butuh bantuan</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tickets.map((ticket) => {
            const Icon = STATUS_ICON[ticket.status];
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/support/${ticket.id}`)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-outline bg-surface px-4 py-4 text-left transition hover:bg-surface-low active:scale-[0.99]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MessageSquare size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{ticket.subject}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(ticket.updated_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {ticket.message_count} pesan
                    </p>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLOR[ticket.status]}`}>
                    <Icon size={11} />
                    {STATUS_LABEL[ticket.status]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </AppFrame>
  );
}
