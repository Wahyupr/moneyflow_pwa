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
  return process.env.EMAIL_FROM ?? "MoneyFlow <onboarding@resend.dev>";
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
    // Log the provider's response server-side for diagnosis (e.g. 403 sandbox
    // restrictions on the resend.dev test sender, unverified domains, invalid
    // API keys) without leaking these details to end users.
    const detail = await response.text().catch(() => "");
    console.error(
      `Resend send failed: status=${response.status} body=${detail.slice(0, 500)}`
    );

    if (response.status === 403) {
      // The shared onboarding@resend.dev sender can only deliver to the account
      // owner's address. A verified domain + EMAIL_FROM on that domain is required
      // to reach other recipients.
      throw new Error(
        "Email sender is not authorized for this recipient. Verify a domain in Resend and set EMAIL_FROM to a sender on that domain."
      );
    }

    // Avoid leaking provider error bodies to callers.
    throw new Error("Failed to send email.");
  }

  return { ok: true };

}

export async function sendVerificationEmail(to: string, code: string): Promise<{ ok: boolean }> {
  const subject = "Kode verifikasi MoneyFlow";
  const text = `Kode verifikasi kamu adalah ${code}. Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.`;
  const html = `
    <body style="margin:0;padding:0;background-color:#eef3fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef3fb;padding:40px 16px;">

        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;">

              <tr>
                <td style="background-color:#1668DC;padding:28px 32px 24px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#bcdcff;letter-spacing:0.08em;text-transform:uppercase;">Verifikasi Akun</p>

                  <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Konfirmasi email kamu</h1>
                </td>
              </tr>

              <tr>
                <td style="padding:32px 32px 8px;">
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#3d4a42;">
                    Halo! Gunakan kode di bawah untuk menyelesaikan pendaftaran akunmu. Kode ini bersifat rahasia — jangan bagikan ke siapa pun.
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="background-color:#e5eeff;border-radius:12px;padding:24px 16px;">
                        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#1668DC;letter-spacing:0.1em;text-transform:uppercase;">Kode verifikasi</p>
                        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.3em;color:#0A3B8C;font-variant-numeric:tabular-nums;">${code}</p>

                        <a href="javascript:void(0)"
                           onclick="
                             var el = document.createElement('textarea');
                             el.value = '${code}';
                             document.body.appendChild(el);
                             el.select();
                             document.execCommand('copy');
                             document.body.removeChild(el);
                             this.innerHTML = '&#10003; Tersalin!';
                             this.style.backgroundColor='#1668DC';
                             this.style.color='#ffffff';
                             this.style.borderColor='#1668DC';
                             var self=this;
                             setTimeout(function(){
                               self.innerHTML='Salin kode';
                               self.style.backgroundColor='transparent';
                               self.style.color='#1668DC';
                               self.style.borderColor='#1668DC';
                             }, 2000);
                           "
                           style="display:inline-block;margin-top:16px;padding:8px 20px;font-size:13px;font-weight:600;color:#1668DC;background-color:transparent;border:1.5px solid #1668DC;border-radius:8px;text-decoration:none;cursor:pointer;">

                          Salin kode
                        </a>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                    <tr>
                      <td style="background-color:#fffbeb;border-left:3px solid #d97706;border-radius:0 8px 8px 0;padding:12px 16px;">
                        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                          ⏱ Kode berlaku selama <strong>10 menit</strong> sejak email ini dikirim.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:24px 32px 0;">
                  <hr style="border:none;border-top:1px solid #e8efec;margin:0;" />
                </td>
              </tr>

              <tr>
                <td style="padding:20px 32px 32px;">
                  <p style="margin:0;font-size:12px;color:#8a9e96;line-height:1.6;">
                    Jika kamu tidak merasa mendaftar, abaikan email ini. Tidak ada tindakan yang perlu dilakukan.
                  </p>
                </td>
              </tr>

            </table>

            <p style="margin:20px 0 0;font-size:11px;color:#9aada5;text-align:center;">
              © 2025 MoneyFlow
            </p>
          </td>
        </tr>
      </table>
    </body>
  `;

  return sendEmail({ to, subject, html, text });
}

/**
 * Sends the password-reset code email. Same template style as the verification
 * email, but with reset-flow copy.
 */
export async function sendPasswordResetEmail(to: string, code: string): Promise<{ ok: boolean }> {
  const subject = "Kode reset kata sandi MoneyFlow";
  const text = `Kode reset kata sandi kamu adalah ${code}. Berlaku 10 menit. Jika kamu tidak meminta reset, abaikan email ini.`;
  const html = `
    <body style="margin:0;padding:0;background-color:#eef3fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef3fb;padding:40px 16px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="background-color:#1668DC;padding:28px 32px 24px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#bcdcff;letter-spacing:0.08em;text-transform:uppercase;">Reset Kata Sandi</p>
                  <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">Atur ulang kata sandi</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 32px 8px;">
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#3d4a42;">
                    Gunakan kode di bawah untuk mengatur ulang kata sandi akunmu. Jika kamu tidak meminta ini, abaikan saja email ini.
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" style="background-color:#e5eeff;border-radius:12px;padding:24px 16px;">
                        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#1668DC;letter-spacing:0.1em;text-transform:uppercase;">Kode reset</p>
                        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.3em;color:#0A3B8C;font-variant-numeric:tabular-nums;">${code}</p>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                    <tr>
                      <td style="background-color:#fffbeb;border-left:3px solid #d97706;border-radius:0 8px 8px 0;padding:12px 16px;">
                        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                          ⏱ Kode berlaku selama <strong>10 menit</strong>. Jangan bagikan ke siapa pun.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px 32px;">
                  <hr style="border:none;border-top:1px solid #e8efec;margin:0 0 20px;" />
                  <p style="margin:0;font-size:12px;color:#8a9e96;line-height:1.6;">
                    Jika kamu tidak meminta reset kata sandi, kamu boleh mengabaikan email ini.
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:11px;color:#9aada5;text-align:center;">© 2025 MoneyFlow</p>
          </td>
        </tr>
      </table>
    </body>
  `;

  return sendEmail({ to, subject, html, text });
}
