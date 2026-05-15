import type { PropsWithChildren } from "react";

import { AuthProvider } from "./AuthProvider";
import { ToastProvider } from "./ToastProvider";

export const AppProviders = ({ children }: PropsWithChildren) => (
  <ToastProvider>
    <AuthProvider>{children}</AuthProvider>
  </ToastProvider>
);
