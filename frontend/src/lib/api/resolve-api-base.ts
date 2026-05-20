const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

export const resolveApiOrigin = (input: {
  configuredBaseUrl?: string;
  isDev: boolean;
}): string => {
  const configured = input.configuredBaseUrl?.trim();

  if (configured) {
    try {
      return trimTrailingSlashes(new URL(configured).toString());
    } catch {
      throw new Error(
        `Invalid VITE_API_BASE_URL "${configured}". Use a fully qualified API origin such as "https://api.example.com".`
      );
    }
  }

  if (input.isDev) {
    return "http://localhost:4000";
  }

  throw new Error(
    "Missing VITE_API_BASE_URL for this production build. Configure the frontend with the deployed backend origin."
  );
};

export const getApiBaseUrl = (input: {
  configuredBaseUrl?: string;
  isDev: boolean;
}): string => `${resolveApiOrigin(input)}/api/v1`;
