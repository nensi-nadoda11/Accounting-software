import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { FormField } from "./FormField";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string | null;
};

export const SearchableSelect = ({
  label,
  value,
  options,
  onChange,
  placeholder = "Select option",
  searchPlaceholder = "Search",
  emptyLabel = "No matches found",
  error,
  disabled,
  allowClear = false,
}: {
  label?: string;
  value: string | null | undefined;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  error?: string;
  disabled?: boolean;
  allowClear?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const selectedOption = options.find((option) => option.value === (value ?? "")) ?? null;
  const filteredOptions = options.filter((option) => {
    if (!normalizedQuery) {
      return true;
    }

    return [option.label, option.description]
      .filter((entry): entry is string => Boolean(entry))
      .some((entry) => entry.toLowerCase().includes(normalizedQuery));
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <FormField label={label} error={error}>
      <div ref={containerRef} className="relative">
        <div
          className={cn(
            "flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white pl-3 pr-2 text-sm text-slate-800 transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10",
            error && "border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-500/10",
            disabled && "cursor-not-allowed bg-slate-50",
          )}
        >
          <button
            type="button"
            disabled={disabled}
            className="flex min-w-0 flex-1 items-center justify-between text-left outline-none"
            onClick={() => setOpen((current) => !current)}
          >
            <span className={cn("truncate", !selectedOption && "text-slate-400")}>{selectedOption?.label ?? placeholder}</span>
            <ChevronDown className="ml-2 size-4 shrink-0 text-slate-400" />
          </button>
          {allowClear && value ? (
            <button
              type="button"
              className="ml-2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onChange("")}
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-2">
              {filteredOptions.length ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition hover:bg-slate-50"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm font-medium text-slate-900">{option.label}</span>
                    {option.description ? <span className="text-xs text-slate-500">{option.description}</span> : null}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-slate-500">{emptyLabel}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </FormField>
  );
};
