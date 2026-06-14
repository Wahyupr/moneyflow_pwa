"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type SelectOption = {
  value: string;
  label: string;
  /** Optional leading icon rendered beside the label. */
  icon?: ReactNode;
};

/**
 * A compact, accessible custom dropdown that matches the app's form styling
 * (used across category/merchant/wallet forms). Native `<select>` can't render
 * icons or be styled consistently across browsers, so this provides a tidy,
 * uniform alternative.
 */
export function SelectMenu({
  value,
  options,
  onChange,
  placeholder = "Pilih...",
  ariaLabel
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative mt-2" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-outline bg-surface px-3 text-left focus:border-primary focus:outline-none"
      >
        {selected?.icon ? <span className="shrink-0 text-primary">{selected.icon}</span> : null}
        <span className={`flex-1 truncate ${selected ? "text-ink" : "text-muted"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-outline bg-surface py-1 shadow-lift"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <li key={option.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm transition ${
                    isSelected ? "bg-primary-container/15 font-semibold text-primary" : "text-ink hover:bg-surface-container"
                  }`}
                >
                  {option.icon ? <span className="shrink-0 text-primary">{option.icon}</span> : null}
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
