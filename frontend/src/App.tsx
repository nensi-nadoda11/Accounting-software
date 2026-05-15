import { AppErrorBoundary } from "./components/feedback/AppErrorBoundary";
import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./router/AppRouter";

function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  );
}

export default App;
