import { format } from "date-fns";

import { runtimePreferences } from "./runtime-preferences";

const DEFAULT_DISPLAY_PATTERN = "dd MMM yyyy";

export const formatPreferredDate = (value: string | Date | null | undefined, pattern = DEFAULT_DISPLAY_PATTERN) => {
  if (!value) {
    return "-";
  }

  const resolvedPattern = pattern === DEFAULT_DISPLAY_PATTERN ? runtimePreferences.resolveDateFormatPattern() : pattern;
  return format(new Date(value), resolvedPattern);
};

export const formatPreferredDateTime = (
  value: string | Date | null | undefined,
  options: { includeSeconds?: boolean } = {},
) => {
  if (!value) {
    return "-";
  }

  const timePattern = options.includeSeconds ? "hh:mm:ss a" : "hh:mm a";
  return format(new Date(value), `${runtimePreferences.resolveDateFormatPattern()}, ${timePattern}`);
};
