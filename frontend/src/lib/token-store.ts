const STORAGE_KEY = "accounting_access_token";

const canUseSessionStorage = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

const readStoredToken = () => {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

let accessToken: string | null = readStoredToken();

export const tokenStore = {
  get: () => accessToken ?? readStoredToken(),
  set: (token: string | null) => {
    accessToken = token;

    if (!canUseSessionStorage()) {
      return;
    }

    try {
      if (token) {
        window.sessionStorage.setItem(STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage is only a resilience layer for page refreshes.
    }
  },
  clear: () => {
    tokenStore.set(null);
  },
};
