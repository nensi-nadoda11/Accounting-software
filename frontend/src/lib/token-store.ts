const STORAGE_KEY = "accounting_access_token";

const canUseStorage = (storage: "localStorage" | "sessionStorage") =>
  typeof window !== "undefined" && typeof window[storage] !== "undefined";

const readFromStorage = (storage: "localStorage" | "sessionStorage") => {
  if (!canUseStorage(storage)) {
    return null;
  }

  try {
    return window[storage].getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const readStoredToken = () => {
  return readFromStorage("localStorage") ?? readFromStorage("sessionStorage");
};

let accessToken: string | null = readStoredToken();

export const tokenStore = {
  get: () => accessToken ?? readStoredToken(),
  set: (token: string | null) => {
    accessToken = token;

    (["localStorage", "sessionStorage"] as const).forEach((storage) => {
      if (!canUseStorage(storage)) {
        return;
      }

      try {
        if (token) {
          window[storage].setItem(STORAGE_KEY, token);
        } else {
          window[storage].removeItem(STORAGE_KEY);
        }
      } catch {
        // Storage is only a resilience layer for page refreshes.
      }
    });
  },
  clear: () => {
    tokenStore.set(null);
  },
};
