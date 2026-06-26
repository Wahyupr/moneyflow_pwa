"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AuthField } from "@/components/auth/auth-field";
import { GoogleTermsModal } from "@/components/auth/google-terms-modal";
import { getAuthApiEndpoint, getPostAuthRedirect } from "@/lib/auth/client";
import { validateLoginInput, validateRegisterInput } from "@/lib/auth-validation";

type AuthMode = "login" | "register";

const oauthErrorMessages: Record<string, string> = {
  oauth_denied: "Google sign-in was cancelled.",
  oauth_init_failed: "Could not start Google sign-in. Please try again.",
  oauth_exchange_failed: "Google sign-in could not be completed. Please try again.",
  oauth_unavailable: "Google sign-in is not available right now.",
  missing_oauth_code: "Google sign-in did not return a valid response.",
  invalid_confirmation_link: "This confirmation link is invalid or incomplete.",
  confirmation_failed: "We couldn't confirm your email. The link may have expired."
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const isRegister = mode === "register";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error");

    if (errorCode) {
      setErrors({ form: oauthErrorMessages[errorCode] ?? "Authentication failed. Please try again." });

      // Remove the error param from the URL so it doesn't persist on refresh
      // or interfere with subsequent actions.
      params.delete("error");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    }
  }, []);

  function openGoogleTerms() {
    if (oauthLoading) return;
    setErrors({});
    setShowTermsModal(true);
  }

  function confirmGoogleOAuth() {
    if (oauthLoading || typeof window === "undefined") return;
    setShowTermsModal(false);
    setOauthLoading(true);
    const next = new URLSearchParams(window.location.search).get("next");
    const target = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";
    window.setTimeout(() => {
      window.location.href = target;
    }, 350);
  }



  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const validation = isRegister
      ? validateRegisterInput({
          fullName: String(formData.get("fullName") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          acceptedTerms: formData.get("acceptedTerms") === "on"
        })
      : validateLoginInput({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? "")
        });

    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(getAuthApiEndpoint(mode), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validation.data)
      });
      const json = await response.json();

      if (!response.ok) {
        // Login attempt on an unverified account: route to verification.
        if (json.requiresEmailConfirmation && typeof window !== "undefined") {
          const verifyEmail = (json.email as string | undefined) ?? String(formData.get("email") ?? "");
          window.location.href = `/verify-email?email=${encodeURIComponent(verifyEmail)}`;
          return;
        }
        setErrors(json.errors ?? { form: json.error ?? "Authentication failed." });
        setSubmitting(false);
        return;
      }


      const redirectPath = getPostAuthRedirect(json);

      if (json.requiresEmailConfirmation) {
        const verifyEmail = (json.email as string | undefined) ?? String(formData.get("email") ?? "");
        if (typeof window !== "undefined") {
          window.location.href = `/verify-email?email=${encodeURIComponent(verifyEmail)}`;
        }
        return;
      }

      // Keep the button in its loading state until the redirect fires — the
      // spinner on the submit button is the user's only feedback here, so we
      // intentionally do not reset `submitting` or surface a status string.
      if (redirectPath && typeof window !== "undefined") {
        window.setTimeout(() => {
          window.location.href = redirectPath;
        }, 500);
      }
    } catch {
      setErrors({ form: "Network error. Please try again." });
      setSubmitting(false);
    }
  }

  return (
    <>
      {showTermsModal ? (
        <GoogleTermsModal
          loading={oauthLoading}
          onCancel={() => setShowTermsModal(false)}
          onConfirm={confirmGoogleOAuth}
        />
      ) : null}
      {oauthLoading ? <GoogleConnectingOverlay /> : null}
      <form className="space-y-4" onSubmit={submit}>
      {isRegister ? <AuthField autoComplete="name" error={errors.fullName} icon={UserRound} id="fullName" label="Full Name" name="fullName" placeholder="Nara Putri" type="text" /> : null}

      <AuthField autoComplete="email" error={errors.email} icon={Mail} id="email" label="Email Address" name="email" placeholder="name@example.com" type="email" />

      <div>
        <AuthField
          action={
            !isRegister ? (
              <Link className="text-xs font-semibold text-primary hover:underline" href="/forgot-password">
                Forgot Password?
              </Link>
            ) : null
          }
          autoComplete={isRegister ? "new-password" : "current-password"}
          error={errors.password}
          icon={Lock}
          id="password"
          label="Password"
          name="password"
          placeholder="Minimum 8 characters"
          type={showPassword ? "text" : "password"}
        />
        <button
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="-mt-10 ml-auto mr-3 flex size-8 items-center justify-center rounded-full text-outline transition hover:bg-surface-container hover:text-ink"
          onClick={() => setShowPassword((value) => !value)}
          type="button"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {isRegister ? (
        <div>
          <label className="flex items-start gap-3 text-sm leading-5 text-muted" htmlFor="acceptedTerms">
            <input className="mt-1 size-4 rounded border-outline text-primary focus:ring-primary" id="acceptedTerms" name="acceptedTerms" type="checkbox" />
            <span>
              Saya menyetujui{" "}
              <a className="font-semibold text-primary underline" href="/syarat-ketentuan" target="_blank" rel="noopener noreferrer">Syarat &amp; Ketentuan</a>{" "}
              dan{" "}
              <a className="font-semibold text-primary underline" href="/kebijakan-refund" target="_blank" rel="noopener noreferrer">Kebijakan Layanan</a>.
            </span>
          </label>
          {errors.acceptedTerms ? <p className="mt-2 text-sm text-error">{errors.acceptedTerms}</p> : null}
        </div>
      ) : null}

      {errors.form ? <p className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{errors.form}</p> : null}

      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-base font-bold text-white shadow-card transition hover:bg-primary-container active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            Please wait
          </>
        ) : (
          <>
            {isRegister ? "Sign Up" : "Sign In"}
            <ArrowRight aria-hidden="true" size={18} />
          </>
        )}
      </button>

      <div className="flex items-center py-2">
        <div className="h-px flex-1 bg-outline" />
        <span className="mx-4 text-xs font-medium text-muted">atau lanjutkan dengan</span>
        <div className="h-px flex-1 bg-outline" />
      </div>
      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline bg-surface text-base font-semibold text-ink transition hover:bg-surface-low active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={oauthLoading}
        onClick={openGoogleTerms}
        type="button"
      >
        {oauthLoading ? (
          <>
            <Loader2 aria-hidden="true" className="animate-spin" size={18} />
            Menghubungkan ke Google…
          </>
        ) : (
          <>
            <GoogleMark />
            Login / Sign up with Google
          </>
        )}
      </button>

    </form>
    </>
  );
}

function GoogleConnectingOverlay() {
  return (
    <div
      aria-live="assertive"
      role="status"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-background/85 px-5 backdrop-blur-md"
    >
      <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-primary-container/25 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-72 rounded-full bg-tertiary/20 blur-3xl" aria-hidden="true" />

      <section className="relative w-full max-w-sm rounded-2xl border border-white/60 bg-white/90 p-6 text-center shadow-lift">
        <div className="relative mx-auto mb-4 flex size-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15" aria-hidden="true" />
          <div className="relative flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-card">
            <Loader2 aria-hidden="true" className="animate-spin" size={26} strokeWidth={2.4} />
          </div>
        </div>
        <p className="text-base font-bold text-ink">Menghubungkan ke Google</p>
        <p className="mt-1 text-sm leading-5 text-muted">
          Membuka halaman login Google yang aman. Mohon tunggu sebentar…
        </p>
      </section>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
