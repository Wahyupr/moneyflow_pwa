"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, Users, XCircle } from "lucide-react";
import { AppFrame } from "@/components/app-frame";

type InviteInfo = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  wallet_color: string;
  inviter_name: string;
  invitee_email: string;
  role: string;
  expires_at: string;
};

type PageState =
  | { status: "loading" }
  | { status: "ready"; invite: InviteInfo }
  | { status: "error"; message: string }
  | { status: "success"; walletId: string; walletName: string };

export default function WalletJoinPage() {
  return (
    <AppFrame title="Terima Undangan" subtitle="Dompet Bersama">
      <WalletJoinContent />
    </AppFrame>
  );
}

function WalletJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [state, setState] = useState<PageState>({ status: "loading" });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Token undangan tidak ditemukan." });
      return;
    }

    void fetch(`/api/wallets/join?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) {
          setState({ status: "error", message: payload.error ?? "Undangan tidak valid." });
        } else {
          setState({ status: "ready", invite: payload.invite as InviteInfo });
        }
      })
      .catch(() => {
        setState({ status: "error", message: "Gagal memuat undangan. Coba lagi." });
      });
  }, [token]);

  async function acceptInvite() {
    if (state.status !== "ready") return;
    setAccepting(true);
    try {
      const res = await fetch("/api/wallets/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      const payload = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: payload.error ?? "Gagal menerima undangan." });
      } else {
        setState({
          status: "success",
          walletId: payload.wallet_id as string,
          walletName: state.invite.wallet_name
        });
      }
    } catch {
      setState({ status: "error", message: "Terjadi kesalahan. Coba lagi." });
    } finally {
      setAccepting(false);
    }
  }

  if (state.status === "loading") {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 text-muted">
        <Loader2 className="animate-spin" size={36} />
        <p className="text-sm">Memuat undangan...</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-error/10 text-error">
          <XCircle size={32} />
        </div>
        <p className="font-semibold text-ink">Undangan Tidak Valid</p>
        <p className="max-w-xs text-sm text-muted">{state.message}</p>
        <button
          className="mt-2 flex min-h-11 items-center gap-2 rounded-lg bg-primary px-6 font-bold text-white active:scale-[0.98]"
          onClick={() => router.push("/wallets")}
          type="button"
        >
          Ke Dompet Saya
        </button>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle size={32} />
        </div>
        <p className="text-xl font-bold text-ink">Berhasil Bergabung!</p>
        <p className="max-w-xs text-sm text-muted">
          Dompet <strong>{state.walletName}</strong> sekarang muncul di halaman dompet kamu.
        </p>
        <button
          className="mt-2 flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 font-bold text-white active:scale-[0.98]"
          onClick={() => router.push("/wallets")}
          type="button"
        >
          Lihat Dompet
        </button>
      </div>
    );
  }

  // state.status === "ready"
  const { invite } = state;
  const expiresDate = new Date(invite.expires_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="mt-6 space-y-5">
      {/* Invite card */}
      <div className="rounded-2xl bg-surface p-5 shadow-card">
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: invite.wallet_color }}
          >
            <Users size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Undangan Dompet Bersama</p>
            <h2 className="text-lg font-bold text-ink">{invite.wallet_name}</h2>
          </div>
        </div>

        <p className="text-sm text-ink">
          <strong>{invite.inviter_name}</strong> mengundang kamu untuk berbagi dompet{" "}
          <strong>"{invite.wallet_name}"</strong> di MoneyFlow.
        </p>

        <div className="mt-4 space-y-2 rounded-xl bg-surface-container p-3 text-sm">
          <InfoRow label="Diundang ke" value={invite.wallet_name} />
          <InfoRow label="Oleh" value={invite.inviter_name} />
          <InfoRow label="Role" value={invite.role === "member" ? "Anggota" : "Penonton"} />
          <InfoRow label="Berlaku sampai" value={expiresDate} />
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Dengan menerima undangan ini, kamu akan bisa melihat dan mencatat transaksi pada dompet bersama.
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-outline bg-surface font-bold text-muted active:scale-[0.98]"
          onClick={() => router.push("/wallets")}
          type="button"
        >
          Tolak
        </button>
        <button
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary font-bold text-white active:scale-[0.98] disabled:opacity-60"
          onClick={() => void acceptInvite()}
          disabled={accepting}
          type="button"
        >
          {accepting ? <Loader2 className="animate-spin" size={18} /> : null}
          {accepting ? "Memproses..." : "Terima Undangan"}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
