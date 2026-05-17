import { Check, ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { cn } from "../../../lib/utils";
import { useDebouncedValue } from "../../customers/useDebouncedValue";
import type { LookupOption } from "../inventoryUtils";

export const InventoryLookupField = ({
  label,
  value,
  onChange,
  loadOptions,
  placeholder = "Select",
  disabled,
  error,
  allowClear = true,
}: {
  label?: string;
  value: LookupOption | null;
  onChange: (next: LookupOption | null) => void;
  loadOptions: (search: string) => Promise<LookupOption[]>;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  allowClear?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const next = await loadOptions(debouncedSearch);

        if (!cancelled) {
          setOptions(next);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Failed to load options");
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, loadOptions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <FormField label={label} error={error}>
      <div ref={containerRef} className="relative">
        <div
          className={cn(
            "flex h-11 w-full items-center rounded-xl border border-slate-200 bg-white pl-3 pr-2 text-sm text-slate-800 transition focus-within:ring-4 focus-within:ring-emerald-500/10",
            error && "border-rose-300",
            open && "border-emerald-500",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((current) => !current)}
            className="flex min-w-0 flex-1 items-center justify-between text-left focus-visible:outline-none"
          >
            <span className={cn("truncate", !value && "text-slate-400")}>{value?.label ?? placeholder}</span>
            <ChevronDown className="size-4 text-slate-400" />
          </button>
          {allowClear && value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="ml-2 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="h-10 pl-9"
              />
            </div>

            <div className="mt-2 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-slate-500">
                  <LoaderCircle className="size-4 animate-spin text-emerald-600" />
                  Loading
                </div>
              ) : loadError ? (
                <div className="px-3 py-4 text-sm text-rose-700">{loadError}</div>
              ) : !options.length ? (
                <div className="px-3 py-4 text-sm text-slate-500">No matches found</div>
              ) : (
                <div className="space-y-1">
                  {options.map((option) => {
                    const selected = option.id === value?.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onChange(option);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-start justify-between rounded-xl px-3 py-2 text-left transition hover:bg-slate-50",
                          selected && "bg-emerald-50",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-900">{option.label}</span>
                          {option.description ? (
                            <span className="block truncate text-xs text-slate-500">{option.description}</span>
                          ) : null}
                        </span>
                        {selected ? <Check className="ml-3 mt-0.5 size-4 shrink-0 text-emerald-600" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </FormField>
  );
};
