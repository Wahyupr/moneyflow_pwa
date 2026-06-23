"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";

type LogEntry = {
  id: string;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  sent_at: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export default function NotificationsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/notifications/logs")
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((json) => {
        if (active) setLogs(json.logs ?? []);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoading(false); });

    // Mark all as read when the page is opened
    fetch("/api/notifications/logs/read", { method: "POST" }).catch(() => undefined);

    return () => { active = false; };
  }, []);

  return (
    <AppFrame title="Notifikasi" subtitle="Riwayat pengingat yang dikirim">
      <div className="mt-4 space-y-3">
        {loading ? (
          <>
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-2xl bg-surface-container" />
            ))}
          </>
        ) : logs.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-surface-container text-muted">
              <BellOff size={28} />
            </div>
            <p className="font-bold text-ink">Belum ada notifikasi</p>
            <p className="text-sm text-muted">
              Notifikasi pengingat tagihan akan muncul di sini setelah dikirim.
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <a
              key={log.id}
              href={log.url}
              className={`flex items-start gap-3 rounded-2xl p-4 shadow-card transition active:scale-[0.99] ${
                log.read_at ? "bg-surface" : "bg-primary/5 ring-1 ring-primary/20"
              }`}
            >
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                log.read_at ? "bg-surface-container text-muted" : "bg-primary/10 text-primary"
              }`}>
                <Bell size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold ${log.read_at ? "text-ink" : "text-primary"}`}>
                    {log.title}
                  </p>
                  {!log.read_at ? (
                    <span className="mt-0.5 size-2 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-muted">{log.body}</p>
                <p className="mt-1 text-[11px] text-muted/70">{timeAgo(log.sent_at)}</p>
              </div>
            </a>
          ))
        )}
      </div>
    </AppFrame>
  );
}
