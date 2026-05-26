import { useEffect } from "react";

import { AppErrorBoundary } from "./components/feedback/AppErrorBoundary";
import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./router/AppRouter";

function App() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLInputElement) || activeElement.type !== "number") {
        return;
      }

      if (document.contains(activeElement)) {
        activeElement.blur();
      }

      event.preventDefault();
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  );
}

export default App;
