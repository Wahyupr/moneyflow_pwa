"use client";

import type { ComponentType, InputHTMLAttributes } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  action?: React.ReactNode;
};

export function AuthField({ label, error, icon: Icon, action, id, ...inputProps }: AuthFieldProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-muted" htmlFor={id}>
          {label}
        </label>
        {action}
      </div>
      <div className="relative rounded-lg transition focus-within:ring-2 focus-within:ring-primary">
        <Icon aria-hidden={true} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={20} />
        <input
          aria-invalid={error ? true : undefined}
          aria-describedby={error && id ? `${id}-error` : undefined}
          className="min-h-12 w-full rounded-lg border border-outline bg-surface px-4 py-3 pl-10 text-base text-ink placeholder:text-outline focus:border-transparent focus:outline-none focus:ring-0"
          id={id}
          {...inputProps}
        />
        {inputProps.type === "password" || inputProps.type === "text" ? null : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-error" id={id ? `${id}-error` : undefined}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
