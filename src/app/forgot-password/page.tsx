"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AuthField } from "@/components/auth/auth-field";

const RESEND_COOLDOWN_SECONDS = 120;

type Step = "request" | "code" | "reset" | "done";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      footer={
        <p>
          Sudah ingat?{" "}
          <Link className="font-bold text-primary hover:underline" href="/login">
            Masuk
          </Link>
        </p>
      }
      subtitle="Masukkan email kamu, lalu cek inbox untuk kode verifikasi."
      title="Reset Kata Sandi"
    >
      <ForgotPasswordFlow />
    </AuthCard>
  );
}

function ForgotPasswordFlow() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Tick-tock the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function postJson<T>(body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await response.json().catch(() => ({}))) as T;
    return { ok: response.ok, status: response.status, data };
  }

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (cooldown > 0) return;
    setError(null);
    setInfo(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("Masukkan email yang valid.");
      return;
    }

    setSubmitting(true);
    try {
      const { ok, status, data } = await postJson<{ error?: string }>({ step: "request", email });
      if (!ok && status !== 429) {
        setError(data?.error ?? "Gagal mengirim kode.");
        return;
      }
      // Anti-enumeration: always advance + always start cooldown, even when the
      // server returned 429 — the user just waits the rest of the window.
      setStep("code");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setInfo("Jika email terdaftar, kode reset sudah dikirim. Periksa inbox/spam.");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Kode harus 6 digit angka.");
      return;
    }

    setSubmitting(true);
    try {
      const { ok, data } = await postJson<{ error?: string }>({ step: "verify", email, code });
      if (!ok) {
        setError(data?.error ?? "Kode tidak valid.");
        return;
      }
      setStep("reset");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }

    setSubmitting(true);
    try {
      const { ok, data } = await postJson<{ error?: string }>({ step: "reset", email, code, newPassword: password });
      if (!ok) {
        setError(data?.error ?? "Gagal mengganti kata sandi.");
        return;
      }
      setStep("done");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg bg-surface-container p-3 text-sm font-semibold text-primary">
          Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.
        </p>
        <Link className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-bold text-white shadow-card" href="/login">
          Kembali ke Masuk <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  if (step === "code" || step === "reset") {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-surface-container p-3 text-sm text-primary">
          Kode dikirim ke <strong>{email}</strong>.
        </p>

        {step === "code" ? (
          <form className="space-y-4" onSubmit={verifyCode}>
            <AuthField
              autoComplete="one-time-code"
              icon={KeyRound}
              id="code"
              inputMode="numeric"
              label="Kode 6 digit"
              maxLength={6}
              name="code"
              onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              type="text"
              value={code}
            />
            {error ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p> : null}
            <button
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-bold text-white shadow-card disabled:opacity-60"
              disabled={submitting || code.length !== 6}
              type="submit"
            >
              {submitting ? "Memverifikasi..." : "Verifikasi Kode"}
              <ArrowRight size={18} />
            </button>

            <button
              className="w-full text-center text-sm font-semibold text-primary disabled:opacity-50"
              disabled={cooldown > 0 || submitting}
              onClick={() => void requestCode()}
              type="button"
            >
              {cooldown > 0 ? `Kirim ulang dalam ${formatSeconds(cooldown)}` : "Kirim ulang kode"}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={resetPassword}>
            <div>
              <AuthField
                autoComplete="new-password"
                icon={Lock}
                id="password"
                label="Kata Sandi Baru"
                name="password"
                onChange={(event) => setPassword(event.currentTarget.value)}
                placeholder="Minimum 8 karakter"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Sembunyikan" : "Tampilkan"}
                className="-mt-10 ml-auto mr-3 flex size-8 items-center justify-center rounded-full text-outline transition hover:bg-surface-container hover:text-ink"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <AuthField
              autoComplete="new-password"
              icon={Lock}
              id="confirmPassword"
              label="Ulangi Kata Sandi"
              name="confirmPassword"
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
              placeholder="Ulangi kata sandi"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
            />

            {error ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p> : null}

            <button
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-bold text-white shadow-card disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
              <ArrowRight size={18} />
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={requestCode}>
      <AuthField
        autoComplete="email"
        icon={Mail}
        id="email"
        label="Email"
        name="email"
        onChange={(event) => setEmail(event.currentTarget.value)}
        placeholder="kamu@email.com"
        type="email"
        value={email}
      />
      {info ? <p className="rounded-lg bg-surface-container p-3 text-sm text-primary">{info}</p> : null}
      {error ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p> : null}

      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-bold text-white shadow-card disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Mengirim..." : "Kirim Kode"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
