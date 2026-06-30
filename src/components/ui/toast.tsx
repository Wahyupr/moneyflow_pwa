"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error";

export type ToastState = { message: string; type: ToastType } | null;

/** Hook — call showToast(msg) to display a 3.5s auto-dismiss notification. */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: ToastType = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { toast, showToast };
}

/** Drop anywhere in the component tree — renders fixed top-right toast. */
export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed right-4 top-4 z-[200] flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lift animate-in fade-in slide-in-from-top-2 duration-200 ${
        toast.type === "success" ? "bg-income text-white" : "bg-expense text-white"
      }`}
    >
      {toast.type === "success" ? (
        <CheckCircle2 size={16} className="shrink-0" />
      ) : (
        <XCircle size={16} className="shrink-0" />
      )}
      {toast.message}
    </div>
  );
}
