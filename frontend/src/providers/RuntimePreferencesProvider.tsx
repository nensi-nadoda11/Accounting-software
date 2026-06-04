import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

import { runtimePreferences } from "../lib/runtime-preferences";

export const RuntimePreferencesProvider = ({ children }: PropsWithChildren) => {
  const [, setRevision] = useState(0);

  useEffect(() => runtimePreferences.subscribe(() => setRevision((current) => current + 1)), []);

  return <>{children}</>;
};
