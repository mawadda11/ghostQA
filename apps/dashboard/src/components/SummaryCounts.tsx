import type { RunSummaryCounts } from "@ghostqa/shared";

const metrics = [
  ["passed", "Passed", "text-emerald-300"],
  ["failed", "Failed", "text-rose-300"],
  ["needsReview", "Needs review", "text-amber-300"],
  ["errors", "Errors", "text-red-300"],
] as const;

export const SummaryCounts = ({ summary }: { summary: RunSummaryCounts }) => (
  <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {metrics.map(([key, label, tone]) => (
      <div
        className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4"
        key={key}
      >
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </dt>
        <dd className={`mt-2 text-2xl font-semibold ${tone}`}>{summary[key]}</dd>
      </div>
    ))}
  </dl>
);

