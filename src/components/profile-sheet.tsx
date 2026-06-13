"use client";

import Link from "next/link";
import { LogOut, Pencil, Shield, SlidersHorizontal, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

type ProfilePayload = {
  user?: { email?: string | null };
  profile?: { display_name?: string | null; hide_nominal_default?: boolean | null };
  entitlement?: { plan?: string | null; status?: string | null };
};

export function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<ProfilePayload>({
    user: { email: "nara@moneyflow.id" },
    profile: { display_name: "Nara Putri" },
    entitlement: { plan: "free", status: "active" }
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (json) {
          setProfile(json);
        }
      })
      .catch(() => undefined);
  }, [open]);

  if (!open) {
    return null;
  }

  const displayName = profile.profile?.display_name || "Nara Putri";
  const email = profile.user?.email || "nara@moneyflow.id";
  const plan = profile.entitlement?.plan || "free";

  return (
    <div className="fixed inset-0 z-[70] bg-ink/20 px-4 pt-16 backdrop-blur-sm md:flex md:items-start md:justify-end md:pr-8" role="dialog" aria-modal="true">
      <section className="mx-auto w-full max-w-sm rounded-xl bg-surface p-4 text-ink shadow-lift md:mx-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
              <UserRound aria-hidden="true" size={23} />
            </div>
            <div>
              <h2 className="text-base font-bold">{displayName}</h2>
              <p className="text-sm text-muted">{email}</p>
              <span className="mt-2 inline-flex rounded-full bg-surface-container px-2 py-1 text-xs font-bold uppercase text-primary">{plan}</span>
            </div>
          </div>
          <button className="flex size-10 items-center justify-center rounded-full text-muted active:bg-surface-container" onClick={onClose} type="button" aria-label="Tutup profil">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-surface-container">
          <ProfileLink href="/settings" icon={Pencil} title="Edit Profile" subtitle="Nama, email, dan preferensi" onClick={onClose} />
          <ProfileLink href="/settings#security" icon={Shield} title="PIN & Security" subtitle="PIN, biometrik, privacy mode" onClick={onClose} />
          <ProfileLink href="/settings#preferences" icon={SlidersHorizontal} title="Settings" subtitle="Merchant rules dan notifikasi" onClick={onClose} />
        </div>

        <button
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-error-container px-4 text-sm font-bold text-on-error-container active:scale-[0.98]"
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" }).finally(() => {
              window.location.href = "/";
            });
          }}
          type="button"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </section>
    </div>
  );
}

function ProfileLink({
  href,
  icon: Icon,
  title,
  subtitle,
  onClick
}: {
  href: string;
  icon: typeof UserRound;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <Link className="flex items-center gap-3 border-b border-surface-container p-4 last:border-b-0 active:bg-surface-low" href={href} onClick={onClick}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-primary">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block truncate text-xs text-muted">{subtitle}</span>
      </span>
    </Link>
  );
}
