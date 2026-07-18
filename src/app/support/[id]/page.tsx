"use client";

import { ArrowLeft, Clock, CheckCircle2, AlertCircle, XCircle, Send, Paperclip, Star, X, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/app-frame";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  category: string;
  rating: number | null;
  rating_comment: string | null;
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
  attachment_url: string | null;
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

const CATEGORY_COLOR: Record<string, string> = {
  Bug: "bg-expense/10 text-expense",
  Pertanyaan: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Fitur: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Billing: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Lainnya: "bg-muted/20 text-muted",
};

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment state
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Rating state
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

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
      if (ticketData.ticket?.rating !== null) setRatingDone(true);
    }).finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/support/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "Gagal upload file.");
        return;
      }
      setAttachmentUrl(json.url);
      setAttachmentName(file.name);
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      e.target.value = "";
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if ((!replyBody.trim() && !attachmentUrl) || !ticketId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: replyBody.trim() || " ",
          ...(attachmentUrl ? { attachment_url: attachmentUrl } : {}),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [...prev, json.message as Message]);
        setReplyBody("");
        setAttachmentUrl(null);
        setAttachmentName(null);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleRatingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ratingValue || !ticketId) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/rating`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rating: ratingValue, rating_comment: ratingComment.trim() || undefined }),
      });
      if (res.ok) {
        setRatingDone(true);
        setTicket((prev) => prev ? { ...prev, rating: ratingValue, rating_comment: ratingComment.trim() || null } : prev);
      }
    } finally {
      setRatingSubmitting(false);
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
  const isOwner = ticket.user_id === currentUserId;

  return (
    <AppFrame title={ticket.subject} subtitle="Detail Tiket">
      <div className="mx-auto flex max-w-2xl flex-col">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/support")}
          className="flex size-9 items-center justify-center rounded-xl border border-outline transition hover:bg-surface-low"
          aria-label="Kembali"
        >
          <ArrowLeft size={16} />
        </button>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[ticket.status]}`}>
          <StatusIcon size={11} />
          {STATUS_LABEL[ticket.status]}
        </span>
        {ticket.category && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${CATEGORY_COLOR[ticket.category] ?? CATEGORY_COLOR["Lainnya"]}`}>
            {ticket.category}
          </span>
        )}
      </div>

      {/* Info closed */}
      {ticket.status === "closed" && (
        <div className="mb-4 rounded-2xl border border-outline bg-surface-low px-4 py-3 text-sm text-muted">
          Tiket ini sudah ditutup. Buat tiket baru jika kamu masih membutuhkan bantuan.
        </div>
      )}

      {/* Rating card — shown to owner when resolved and not yet rated */}
      {ticket.status === "resolved" && isOwner && !ratingDone && (
        <form
          onSubmit={handleRatingSubmit}
          className="mb-4 rounded-2xl border border-outline bg-surface p-4"
        >
          <p className="mb-2 text-sm font-semibold text-ink">Bagaimana layanan support kami?</p>
          <div className="mb-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingValue(star)}
                onMouseEnter={() => setRatingHover(star)}
                onMouseLeave={() => setRatingHover(0)}
                aria-label={`${star} bintang`}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={26}
                  className={
                    star <= (ratingHover || ratingValue)
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted/30"
                  }
                />
              </button>
            ))}
          </div>
          <textarea
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder="Komentar tambahan (opsional)..."
            rows={2}
            maxLength={1000}
            className="mb-3 w-full resize-none rounded-xl border border-outline bg-surface-low px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={ratingSubmitting || ratingValue === 0}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {ratingSubmitting ? "Mengirim..." : "Kirim Rating"}
          </button>
        </form>
      )}

      {/* Rating submitted confirmation */}
      {ticket.status === "resolved" && isOwner && ratingDone && ticket.rating && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-income/20 bg-income/5 px-4 py-3">
          <CheckCircle2 size={16} className="shrink-0 text-income" />
          <div>
            <p className="text-sm font-semibold text-ink">Terima kasih atas feedback kamu!</p>
            <div className="mt-0.5 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={13}
                  className={s <= ticket.rating! ? "fill-amber-400 text-amber-400" : "text-muted/30"}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="mb-4 flex-1 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          const isStaff = msg.sender_role === "admin" || msg.sender_role === "cs";
          const hasImage = msg.attachment_url && isImageUrl(msg.attachment_url);
          const hasFile = msg.attachment_url && !isImageUrl(msg.attachment_url);
          const bodyText = msg.body.trim();

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMe ? "bg-primary text-white" : "bg-surface border border-outline"}`}>
                {!isMe && (
                  <p className="mb-1 text-[11px] font-semibold text-muted">
                    {isStaff ? "Tim Support MoneyFlow" : (msg.sender_display_name ?? msg.sender_email)}
                  </p>
                )}
                {bodyText && bodyText !== " " && (
                  <p className={`text-sm leading-relaxed ${isMe ? "text-white" : "text-ink"}`}>{bodyText}</p>
                )}
                {hasImage && (
                  <a href={msg.attachment_url!} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.attachment_url!}
                      alt="Lampiran"
                      className="max-h-48 rounded-xl object-cover"
                    />
                  </a>
                )}
                {hasFile && (
                  <a
                    href={msg.attachment_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition hover:brightness-90 ${isMe ? "border-white/20 text-white" : "border-outline text-ink"}`}
                  >
                    <FileText size={14} />
                    Lihat Lampiran
                  </a>
                )}
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
        <div className="space-y-2">
          {/* Attachment preview */}
          {attachmentUrl && (
            <div className="flex items-center gap-2 rounded-xl border border-outline bg-surface-low px-3 py-2">
              {isImageUrl(attachmentUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachmentUrl} alt="Preview" className="size-8 rounded-lg object-cover" />
              ) : (
                <FileText size={16} className="shrink-0 text-muted" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-ink">{attachmentName ?? "Lampiran"}</span>
              <button
                type="button"
                onClick={() => { setAttachmentUrl(null); setAttachmentName(null); }}
                className="shrink-0 text-muted hover:text-expense"
                aria-label="Hapus lampiran"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {uploadError && <p className="text-xs text-expense">{uploadError}</p>}

          <form onSubmit={handleReply} className="flex gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Lampirkan gambar"
              className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-outline text-muted transition hover:bg-surface-low disabled:opacity-50"
            >
              {uploading ? (
                <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <Paperclip size={16} />
              )}
            </button>
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
              disabled={sending || (!replyBody.trim() && !attachmentUrl)}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:brightness-105 disabled:opacity-50"
              aria-label="Kirim"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
      </div>
    </AppFrame>
  );
}
