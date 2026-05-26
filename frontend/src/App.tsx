import { useEffect } from "react";

import { AppErrorBoundary } from "./components/feedback/AppErrorBoundary";
import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./router/AppRouter";

const isNumberInputElement = (element: EventTarget | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === "number";

function App() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const targetElement = isNumberInputElement(event.target) ? event.target : document.activeElement;
      if (!isNumberInputElement(targetElement)) {
        return;
      }

      if (document.contains(targetElement)) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const targetElement = isNumberInputElement(event.target) ? event.target : document.activeElement;
      if (!isNumberInputElement(targetElement)) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("wheel", handleWheel, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
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
