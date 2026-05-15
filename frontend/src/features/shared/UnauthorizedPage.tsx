import { Link } from "react-router-dom";

import { Button } from "../../components/ui/Button";

export const UnauthorizedPage = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#F7FAFA] px-4">
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Unauthorized</h1>
      <p className="mt-3 text-sm text-slate-500">You do not have permission to access this page.</p>
      <div className="mt-6">
        <Link to="/app">
          <Button>Back to App</Button>
        </Link>
      </div>
    </div>
  </div>
);
