import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { LegalNav, LegalFooter } from "@/app/faq/page";

export const metadata = {
  title: "Kontak — MoneyFlow",
  description: "Hubungi tim MoneyFlow melalui email, telepon, atau WhatsApp."
};

export default function KontakPage() {
  return (
    <main className="min-h-dvh bg-background text-ink">
      <LegalNav />
      <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">Hubungi Kami</h1>
        <p className="mt-3 text-muted">
          Ada pertanyaan, masukan, atau butuh bantuan? Tim kami siap membantu kamu.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* Email */}
          <a
            href="mailto:contact@whypratama.com"
            className="group flex items-start gap-4 rounded-2xl border border-outline bg-surface p-6 shadow-card transition hover:-translate-y-1 hover:shadow-lift"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
              <Mail size={22} />
            </span>
            <div>
              <p className="font-bold">Email</p>
              <p className="mt-1 text-sm font-semibold text-primary">contact@whypratama.com</p>
              <p className="mt-1 text-xs text-muted">Balas dalam 1×24 jam kerja</p>
            </div>
          </a>

          {/* Telepon / WhatsApp */}
          <a
            href="https://wa.me/6282285718485"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-2xl border border-outline bg-surface p-6 shadow-card transition hover:-translate-y-1 hover:shadow-lift"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-income/10 text-income transition-transform group-hover:scale-110">
              <Phone size={22} />
            </span>
            <div>
              <p className="font-bold">Telepon / WhatsApp</p>
              <p className="mt-1 text-sm font-semibold text-primary">082285718485</p>
              <p className="mt-1 text-xs text-muted">WhatsApp lebih cepat direspons</p>
            </div>
          </a>
        </div>

        {/* CTA kirim email */}
        <div className="mt-10 rounded-2xl bg-primary/5 border border-primary/20 px-6 py-8 text-center">
          <h2 className="text-lg font-bold">Butuh bantuan segera?</h2>
          <p className="mt-2 text-sm text-muted">
            Kirim email ke kami dan kami akan merespons dalam satu hari kerja.
          </p>
          <a
            href="mailto:contact@whypratama.com"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-card transition active:scale-[0.98]"
          >
            <Mail size={16} />
            Kirim Email
          </a>
        </div>
      </div>
      <LegalFooter />
    </main>
  );
}
