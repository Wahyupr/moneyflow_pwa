"use client";

import { MessageSquare, Clock, CheckCircle2, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
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

const ALL_STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

export default function AdminSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketStatus | "all">("all");

  useEffect(() => {
    fetch("/api/support/tickets")
      .then((r) => r.json())
      .then((json) => setTickets(json.tickets ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const counts = ALL_STATUSES.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: tickets.filter((t) => t.status === s).length }),
    {}
  );

  return (
    <AppFrame title="Dashboard Support" subtitle="Kelola semua tiket keluhan dari pengguna">
      <div className="mx-auto max-w-3xl">

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ALL_STATUSES.map((s) => {
          const Icon = STATUS_ICON[s];
          return (
            <div key={s} className="rounded-2xl border border-outline bg-surface px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Icon size={13} className="text-muted" />
                <span className="text-xs text-muted">{STATUS_LABEL[s]}</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-ink">{counts[s] ?? 0}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === "all" ? "bg-primary text-white" : "border border-outline text-muted hover:bg-surface-low"}`}
        >
          Semua ({tickets.length})
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === s ? "bg-primary text-white" : "border border-outline text-muted hover:bg-surface-low"}`}
          >
            {STATUS_LABEL[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-outline bg-surface py-16 text-center">
          <MessageSquare size={36} className="mb-3 text-muted/40" />
          <p className="text-sm font-semibold text-ink">Tidak ada tiket</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((ticket) => {
            const Icon = STATUS_ICON[ticket.status];
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/admin/support/${ticket.id}`)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-outline bg-surface px-4 py-4 text-left transition hover:bg-surface-low"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MessageSquare size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{ticket.subject}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {ticket.user_email}
                      {" · "}
                      {new Date(ticket.updated_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_COLOR[ticket.status]}`}>
                      <Icon size={11} />
                      {STATUS_LABEL[ticket.status]}
                    </span>
                    <ArrowRight size={14} className="text-muted opacity-0 transition group-hover:opacity-100" />
                  </div>
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
