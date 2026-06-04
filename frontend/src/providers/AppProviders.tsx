import type { PropsWithChildren } from "react";

import { AuthProvider } from "./AuthProvider";
import { RuntimePreferencesProvider } from "./RuntimePreferencesProvider";
import { ToastProvider } from "./ToastProvider";

export const AppProviders = ({ children }: PropsWithChildren) => (
  <ToastProvider>
    <RuntimePreferencesProvider>
      <AuthProvider>{children}</AuthProvider>
    </RuntimePreferencesProvider>
  </ToastProvider>
);
