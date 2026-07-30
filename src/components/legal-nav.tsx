"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Top navigation bar for the "legal"/info pages (FAQ, Kontak, Syarat &
 * Ketentuan, Kebijakan Refund).
 *
 * The "Kembali" control uses browser history so it returns the user to wherever
 * they came from — e.g. Settings when opened from the in-app menu, or the
 * landing page when opened from the public footer. When there is no history to
 * go back to (direct navigation / fresh tab), it falls back to the home page.
 */
export function LegalNav() {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-outline/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} />
          Kembali
        </button>
        <span className="text-outline">|</span>
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/brand-mark.svg" alt="MoneyFlow" className="size-7 rounded-lg" />
          <span className="font-bold">MoneyFlow</span>
        </Link>
      </div>
    </nav>
  );
}
