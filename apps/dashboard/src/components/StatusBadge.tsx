import type { DisplayStatus } from "../utils/presentation.js";
import { statusClasses, statusLabel } from "../utils/presentation.js";

export interface StatusBadgeProps {
  status: DisplayStatus | undefined;
  label?: string;
}

export const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  if (status === undefined) {
    return (
      <span className="inline-flex rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-semibold text-slate-400">
        {label ?? "Not available"}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${statusClasses(status)}`}
    >
      {label ?? statusLabel(status)}
    </span>
  );
};
