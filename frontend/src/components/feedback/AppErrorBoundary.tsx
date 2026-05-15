import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "../ui/Button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Frontend render error", error, errorInfo);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F7FAFA] px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-500">
              The app hit an unexpected issue. Please refresh and try again.
            </p>
            <div className="mt-6">
              <Button onClick={() => window.location.reload()}>Reload App</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
