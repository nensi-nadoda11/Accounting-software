import { Search, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { cn } from "../../../lib/utils";
import { useDebouncedValue } from "../../customers/useDebouncedValue";

export type LookupOption = {
  id: string;
  label: string;
  description?: string | null;
  meta?: string | null;
};

export const AsyncLookupSelect = ({
  label,
  placeholder,
  value,
  loading,
  options,
  error,
  disabled,
  noResultsLabel = "No results found",
  idleLabel = "Type to search",
  onSearch,
  onSelect,
  onClear,
}: {
  label?: string;
  placeholder?: string;
  value: LookupOption | null;
  loading?: boolean;
  options: LookupOption[];
  error?: string;
  disabled?: boolean;
  noResultsLabel?: string;
  idleLabel?: string;
  onSearch: (value: string) => void;
  onSelect: (option: LookupOption) => void;
  onClear?: () => void;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const normalizedQuery = debouncedQuery.trim();
  const triggerSearch = useEffectEvent((searchValue: string) => {
    onSearch(searchValue);
  });

  useEffect(() => {
    if (!open || disabled || !normalizedQuery) {
      return;
    }

    triggerSearch(normalizedQuery);
  }, [disabled, normalizedQuery, open, triggerSearch]);

  useEffect(() => {
    if (!open) {
      setQuery(value?.label ?? "");
    }
  }, [open, value]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative flex w-full flex-col gap-2">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <div
        className={cn(
          "relative rounded-xl border border-slate-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10",
          error && "border-rose-300 focus-within:border-rose-500 focus-within:ring-rose-500/10",
          disabled && "bg-slate-50",
        )}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={open ? query : value?.label ?? query}
          disabled={disabled}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl bg-transparent pl-9 pr-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
          onFocus={() => {
            setOpen(true);
            setQuery(value?.label ?? query);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) {
              setOpen(true);
            }
          }}
        />
        {value && onClear ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={() => {
              onClear();
              setQuery("");
              setOpen(false);
            }}
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </button>
        ) : null}
        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="max-h-64 overflow-y-auto py-2">
              {!normalizedQuery ? (
                <div className="px-3 py-3 text-sm text-slate-500">{idleLabel}</div>
              ) : loading ? (
                <div className="px-3 py-3 text-sm text-slate-500">Loading...</div>
              ) : options.length ? (
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition hover:bg-slate-50"
                    onClick={() => {
                      onSelect(option);
                      setQuery(option.label);
                      setOpen(false);
                    }}
                  >
                    <span className="text-sm font-medium text-slate-900">{option.label}</span>
                    {option.description ? <span className="text-xs text-slate-500">{option.description}</span> : null}
                    {option.meta ? <span className="text-[11px] uppercase tracking-wide text-slate-400">{option.meta}</span> : null}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-slate-500">{noResultsLabel}</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
};
