"use client";

import { ArrowLeft, Delete } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const OTP_LENGTH = 6;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return email;
  }
  const visible = local.slice(0, 3);
  return `${visible}${"*".repeat(Math.max(local.length - 3, 1))}@${domain}`;
}

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams?.get("email") ?? "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const code = digits.join("");
  const activeIndex = Math.min(code.length, OTP_LENGTH - 1);
  const isComplete = code.length === OTP_LENGTH;

  const appendDigit = useCallback((value: string) => {
    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      const index = next.findIndex((d) => d === "");
      if (index === -1) {
        return prev;
      }
      next[index] = value;
      return next;
    });
  }, []);

  const deleteDigit = useCallback(() => {
    setError(null);
    setDigits((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i] !== "") {
          next[i] = "";
          break;
        }
      }
      return next;
    });
  }, []);

  // Physical keyboard + paste support alongside the on-screen pad.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) {
        appendDigit(event.key);
      } else if (event.key === "Backspace") {
        deleteDigit();
      }
    }

    function onPaste(event: ClipboardEvent) {
      const pasted = event.clipboardData?.getData("text")?.replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (pasted) {
        event.preventDefault();
        setError(null);
        setDigits(() => {
          const next = Array(OTP_LENGTH).fill("");
          pasted.split("").forEach((char, index) => {
            next[index] = char;
          });
          return next;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("paste", onPaste);
    };
  }, [appendDigit, deleteDigit]);

  async function verify() {
    if (!isComplete || submitting) {
      return;
    }

    setError(null);
    setStatus(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code })
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(json.error ?? "Verification failed.");
        setDigits(Array(OTP_LENGTH).fill(""));
        return;
      }

      setStatus("Email verified. Opening dashboard.");
      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (resending || !email) {
      return;
    }

    setError(null);
    setStatus(null);
    setResending(true);

    try {
      const response = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email })
      });
      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(json.error ?? "Could not resend the code.");
        return;
      }

      setStatus("A new code has been sent. Check your email.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  const padKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"] as const;

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <header className="z-10 mx-auto flex h-16 w-full max-w-md shrink-0 items-center px-5">
        <button
          aria-label="Back"
          className="flex size-10 items-center justify-start rounded-full text-muted transition-colors hover:bg-surface-low active:scale-95"
          onClick={() => router.push("/login")}
          type="button"
        >
          <ArrowLeft size={24} />
        </button>
      </header>

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-4">
        <div className="mb-10">
          <h1 className="mb-3 text-2xl font-bold tracking-tight">Verify Email</h1>
          <p className="pr-4 text-base leading-6 text-muted">
            Enter the 6-digit code we sent to your email
            <br />
            <span className="mt-1 inline-block font-medium text-ink">{email ? maskEmail(email) : "your email"}</span>
          </p>
        </div>

        <div aria-label="One time password" className="mb-10 flex items-center justify-between gap-2">
          {digits.map((digit, index) => {
            const isActive = !isComplete && index === activeIndex;
            return (
              <div
                className={`relative flex h-14 w-12 items-center justify-center rounded-xl bg-surface shadow-card ${
                  isActive ? "border-2 border-primary" : "border border-transparent"
                }`}
                key={index}
              >
                {digit ? (
                  <span className="text-3xl font-bold text-ink">{digit}</span>
                ) : isActive ? (
                  <span className="otp-caret" />
                ) : null}
              </div>
            );
          })}
        </div>

        {error ? (
          <p className="mb-4 rounded-lg bg-[#ffdad6] p-3 text-center text-sm text-[#93000a]">{error}</p>
        ) : null}
        {status ? <p className="mb-4 rounded-lg bg-surface-container p-3 text-center text-sm text-primary">{status}</p> : null}

        <div className="mb-auto text-center">
          <p className="text-sm text-muted">
            Didn&apos;t receive the code?
            <button
              className="ml-1 rounded px-1 font-medium text-primary transition-opacity hover:underline active:opacity-70 disabled:opacity-50"
              disabled={resending || !email}
              onClick={resend}
              type="button"
            >
              {resending ? "Sending…" : "Resend Code"}
            </button>
          </p>
        </div>

        <div className="mb-6 mt-8 shrink-0">
          <button
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-primary text-base font-semibold text-white shadow-lift transition-all hover:bg-primary-container active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isComplete || submitting}
            onClick={verify}
            type="button"
          >
            {submitting ? "Verifying…" : "Verify Code"}
          </button>
        </div>
      </main>

      <div className="z-20 mx-auto w-full max-w-md shrink-0 rounded-t-3xl border-t border-outline/30 bg-surface px-6 pb-8 pt-6 shadow-lift">
        <div className="grid grid-cols-3 gap-x-6 gap-y-4">
          {padKeys.map((key, index) => {
            if (key === "") {
              return <div className="h-14 w-full" key={`spacer-${index}`} />;
            }

            if (key === "delete") {
              return (
                <button
                  aria-label="Delete"
                  className="flex h-14 w-full select-none items-center justify-center rounded-2xl text-muted transition-colors active:bg-surface-container"
                  key="delete"
                  onClick={deleteDigit}
                  type="button"
                >
                  <Delete size={30} />
                </button>
              );
            }

            return (
              <button
                className="flex h-14 w-full select-none items-center justify-center rounded-2xl text-[28px] font-medium text-ink transition-colors active:bg-surface-container"
                key={key}
                onClick={() => appendDigit(key)}
                type="button"
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
