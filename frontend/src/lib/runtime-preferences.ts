import type { CompanyPreferences } from "../types/company";

const STORAGE_KEY = "accounting_runtime_preferences_v1";

export type RuntimePreferencesSnapshot = {
  dateFormat: CompanyPreferences["dateFormat"] | null;
  roundOffEnabled: boolean | null;
};

const DATE_FORMATS: Array<CompanyPreferences["dateFormat"]> = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
];

const DEFAULT_SNAPSHOT: RuntimePreferencesSnapshot = {
  dateFormat: null,
  roundOffEnabled: null,
};

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const normalizeDateFormat = (value: unknown): CompanyPreferences["dateFormat"] | null =>
  typeof value === "string" && DATE_FORMATS.includes(value as CompanyPreferences["dateFormat"])
    ? (value as CompanyPreferences["dateFormat"])
    : null;

const readStoredSnapshot = (): RuntimePreferencesSnapshot => {
  if (!canUseStorage()) {
    return DEFAULT_SNAPSHOT;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SNAPSHOT;
    }

    const parsed = JSON.parse(raw) as Partial<RuntimePreferencesSnapshot> | null;
    return {
      dateFormat: normalizeDateFormat(parsed?.dateFormat),
      roundOffEnabled: typeof parsed?.roundOffEnabled === "boolean" ? parsed.roundOffEnabled : null,
    };
  } catch {
    return DEFAULT_SNAPSHOT;
  }
};

let snapshot: RuntimePreferencesSnapshot = readStoredSnapshot();
const listeners = new Set<() => void>();

const persistSnapshot = () => {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Preferences are a convenience cache; failures should not break the app.
  }
};

const emitChange = () => {
  persistSnapshot();
  listeners.forEach((listener) => listener());
};

const patchSnapshot = (patch: Partial<RuntimePreferencesSnapshot>) => {
  snapshot = {
    ...snapshot,
    ...patch,
  };

  emitChange();
};

export const runtimePreferences = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  setDateFormat: (dateFormat: CompanyPreferences["dateFormat"] | null | undefined) => {
    patchSnapshot({ dateFormat: normalizeDateFormat(dateFormat) });
  },
  setRoundOffEnabled: (roundOffEnabled: boolean | null | undefined) => {
    patchSnapshot({ roundOffEnabled: typeof roundOffEnabled === "boolean" ? roundOffEnabled : null });
  },
  getDateFormat: () => snapshot.dateFormat ?? "DD/MM/YYYY",
  resolveDateFormatPattern: () => {
    switch (snapshot.dateFormat ?? "DD/MM/YYYY") {
      case "MM/DD/YYYY":
        return "MM/dd/yyyy";
      case "YYYY-MM-DD":
        return "yyyy-MM-dd";
      case "DD-MM-YYYY":
        return "dd-MM-yyyy";
      case "DD/MM/YYYY":
      default:
        return "dd/MM/yyyy";
    }
  },
  resolveRoundOffEnabled: (fallback = true) => snapshot.roundOffEnabled ?? fallback,
};
