export const FormError = ({ error }: { error?: string }) =>
  error ? <div className="app-feedback-error rounded-xl border px-3 py-2 text-sm">{error}</div> : null;
