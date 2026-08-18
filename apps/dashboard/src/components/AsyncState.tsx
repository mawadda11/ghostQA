import { ApiClientError } from "../api/client.js";

export const LoadingState = ({ label = "Loading…" }: { label?: string }) => (
  <div
    aria-live="polite"
    className="flex min-h-48 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 px-6 py-12"
  >
    <div className="text-center">
      <span className="mx-auto block size-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300" />
      <p className="mt-4 text-sm text-slate-400">{label}</p>
    </div>
  </div>
);

export const ErrorState = ({
  error,
  onRetry,
  title = "Unable to load this view",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) => {
  const message =
    error instanceof ApiClientError
      ? error.message
      : "GhostQA could not complete this request.";
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-6 py-8"
    >
      <p className="font-semibold text-rose-200">{title}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-100/70">
        {message}
      </p>
      {onRetry === undefined ? null : (
        <button
          className="mt-5 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3.5 py-2 text-sm font-medium text-rose-100 hover:bg-rose-300/15"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      )}
    </div>
  );
};

export const EmptyState = ({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) => (
  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/35 px-6 py-12 text-center">
    <div className="mx-auto grid size-10 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-lg text-cyan-300">
      —
    </div>
    <h2 className="mt-4 font-semibold text-slate-100">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
      {message}
    </p>
    {action === undefined ? null : <div className="mt-5">{action}</div>}
  </div>
);

