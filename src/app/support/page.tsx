"use client";

import { ArrowRight, MessageSquare, Plus, Clock, CheckCircle2, AlertCircle, XCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type Ticket = {
  id: string;
  subject: string;
  status: TicketStatus;
  category: string;
  created_at: string;
  updated_at: string;
  message_count: string;
};

const TICKET_CATEGORIES = ["Bug", "Pertanyaan", "Fitur", "Billing", "Lainnya"] as const;
type TicketCategory = typeof TICKET_CATEGORIES[number];

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

const CATEGORY_COLOR: Record<string, string> = {
  Bug: "bg-expense/10 text-expense",
  Pertanyaan: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Fitur: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Billing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Lainnya: "bg-muted/20 text-muted",
};

const FILTER_TABS: { label: string; value: TicketStatus | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Terbuka", value: "open" },
  { label: "Diproses", value: "in_progress" },
  { label: "Selesai", value: "resolved" },
  { label: "Ditutup", value: "closed" },
];

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>("Lainnya");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");

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
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), category }),
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
      setCategory("Lainnya");
      router.push(`/support/${json.ticket.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchSearch = search.trim() === "" || t.subject.toLowerCase().includes(search.trim().toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [tickets, statusFilter, search]);

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
            <label className="mb-1.5 block text-xs font-semibold text-muted">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="w-full rounded-xl border border-outline bg-surface-low px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
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

      {/* Search & filter */}
      {!loading && tickets.length > 0 && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tiket..."
              className="w-full rounded-xl border border-outline bg-surface-low py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === tab.value
                    ? "bg-primary text-white"
                    : "bg-surface border border-outline text-muted hover:bg-surface-low"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-outline bg-surface py-16 text-center">
          <MessageSquare size={36} className="mb-3 text-muted/40" />
          <p className="text-sm font-semibold text-ink">
            {tickets.length === 0 ? "Belum ada tiket" : "Tidak ada tiket yang cocok"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {tickets.length === 0 ? "Buat tiket baru jika kamu butuh bantuan" : "Coba ubah filter atau kata kunci pencarian"}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredTickets.map((ticket) => {
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
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{ticket.subject}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${CATEGORY_COLOR[ticket.category] ?? CATEGORY_COLOR["Lainnya"]}`}>
                        {ticket.category}
                      </span>
                    </div>
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
