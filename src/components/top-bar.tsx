"use client";

import { Eye, EyeOff, UserRound } from "lucide-react";
import { useState } from "react";
import { ProfileSheet } from "@/components/profile-sheet";
import { usePrivacy } from "@/components/privacy-provider";

export function TopBar({ title = "MoneyFlow", subtitle }: { title?: string; subtitle?: string }) {
  const { hidden, toggleHidden } = usePrivacy();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 -mx-5 flex min-h-16 items-center justify-between bg-background/95 px-5 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
        <button
          className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary shadow-card active:scale-95 md:hidden"
          onClick={() => setProfileOpen(true)}
          type="button"
          aria-label="Buka profile"
        >
          <UserRound size={20} />
        </button>
        <div className="min-w-0 flex-1 px-3 md:px-0">
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
          <h1 className="truncate text-xl font-bold text-primary">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={hidden ? "Show nominal" : "Hide nominal"}
            className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-card active:scale-95"
            onClick={toggleHidden}
            type="button"
          >
            {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
          <button
            className="hidden size-10 items-center justify-center rounded-full bg-surface-container text-primary shadow-card active:scale-95 md:flex"
            onClick={() => setProfileOpen(true)}
            type="button"
            aria-label="Buka profile"
          >
            <UserRound size={20} />
          </button>
        </div>
      </header>
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
