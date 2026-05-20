const ACCESS_TOKEN_STORAGE_KEY = "ledgerflow.access_token";

const readStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

let accessToken: string | null = readStoredToken();

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;

    if (typeof window === "undefined") {
      return;
    }

    try {
      if (token) {
        window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures and keep the in-memory token available.
    }
  },
  clear: () => {
    tokenStore.set(null);
  },
};
