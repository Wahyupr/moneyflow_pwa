/**
 * Server-only email sender backed by the Resend REST API.
 *
 * The API key is read from RESEND_API_KEY and is never exposed to the client
 * or logged. Send failures are surfaced as a generic error so internal details
 * (provider responses) do not leak to end users.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function getResendApiKey(): string {
  return process.env.RESEND_API_KEY ?? "";
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? "FinanceApp <onboarding@resend.dev>";
}

export function hasEmailConfig(): boolean {
  return Boolean(getResendApiKey());
}

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean }> {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new Error("Email provider is not configured.");
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!response.ok) {
    // Avoid leaking provider error bodies to callers.
    throw new Error("Failed to send email.");
  }

  return { ok: true };
}

export async function sendVerificationEmail(to: string, code: string): Promise<{ ok: boolean }> {
  const subject = "Kode verifikasi FinanceApp";
  const text = `Kode verifikasi kamu adalah ${code}. Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.`;
  const html = `
    <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0b1c30">
      <h1 style="font-size:20px;font-weight:600;margin:0 0 12px">Verifikasi email kamu</h1>
      <p style="font-size:16px;line-height:24px;margin:0 0 16px">Masukkan kode berikut untuk menyelesaikan pendaftaran:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:0.2em;background:#e5eeff;border-radius:12px;padding:16px;text-align:center;color:#006948">${code}</div>
      <p style="font-size:14px;line-height:20px;color:#3d4a42;margin:16px 0 0">Kode berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>
    </div>
  `;

  return sendEmail({ to, subject, html, text });
}
