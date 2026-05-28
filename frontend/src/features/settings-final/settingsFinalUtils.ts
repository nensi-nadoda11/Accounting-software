import { AxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

const normalizeServerField = (field: string) => {
  if (field.startsWith("body.")) {
    return field.slice(5);
  }

  return field;
};

export const applySettingsFieldErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  fallbackMappings?: Array<{ includes: string; field: Path<TFieldValues>; message?: string }>,
) => {
  if (!(error instanceof AxiosError) || !error.response) {
    return false;
  }

  const data = error.response.data as ApiErrorShape | undefined;
  const handled = new Set<string>();

  for (const item of data?.errors ?? []) {
    const separatorIndex = item.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const field = normalizeServerField(item.slice(0, separatorIndex).trim()) as Path<TFieldValues>;
    const message = item.slice(separatorIndex + 1).trim();

    if (!field || !message) {
      continue;
    }

    handled.add(field);
    setError(field, { type: "server", message });
  }

  const normalizedMessage = data?.message?.toLowerCase() ?? "";
  for (const mapping of fallbackMappings ?? []) {
    if (normalizedMessage.includes(mapping.includes.toLowerCase())) {
      handled.add(mapping.field);
      setError(mapping.field, {
        type: "server",
        message: mapping.message ?? data?.message ?? "Please review this field",
      });
    }
  }

  return handled.size > 0;
};
