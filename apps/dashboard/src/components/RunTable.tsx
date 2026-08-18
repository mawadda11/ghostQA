import type {
  GlobalTestRunHistoryItem,
  TestRunHistoryItem,
} from "@ghostqa/shared";
import { Link } from "react-router-dom";

import { formatDateTime, runDuration } from "../utils/presentation.js";
import { StatusBadge } from "./StatusBadge.js";

type RunRow = TestRunHistoryItem | GlobalTestRunHistoryItem;

const hasProjectName = (
  run: RunRow,
): run is GlobalTestRunHistoryItem => "projectName" in run;

export const RunTable = ({
  runs,
  showProject = false,
}: {
  runs: readonly RunRow[];
  showProject?: boolean;
}) => (
  <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/45">
    <table className="w-full min-w-[820px] border-collapse text-left text-sm">
      <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          {showProject ? <th className="px-4 py-3 font-medium">Project</th> : null}
          <th className="px-4 py-3 font-medium">Flow</th>
          <th className="px-4 py-3 font-medium">Started</th>
          <th className="px-4 py-3 font-medium">Duration</th>
          <th className="px-4 py-3 font-medium">Execution</th>
          <th className="px-4 py-3 font-medium">Baseline</th>
          <th className="px-4 py-3 text-center font-medium">Pass</th>
          <th className="px-4 py-3 text-center font-medium">Fail</th>
          <th className="px-4 py-3 text-center font-medium">Review</th>
          <th className="px-4 py-3 text-center font-medium">Error</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/80">
        {runs.map((run) => (
          <tr className="hover:bg-white/[0.025]" key={run.id}>
            {showProject ? (
              <td className="px-4 py-4 font-medium text-slate-200">
                {hasProjectName(run) ? run.projectName : "—"}
              </td>
            ) : null}
            <td className="px-4 py-4">
              <Link
                className="font-medium text-cyan-300 hover:text-cyan-200"
                to={`/runs/${run.id}`}
              >
                {run.flowName}
              </Link>
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-slate-400">
              {formatDateTime(run.startedAt)}
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-slate-400">
              {runDuration(run.startedAt, run.completedAt)}
            </td>
            <td className="px-4 py-4"><StatusBadge status={run.status} /></td>
            <td className="px-4 py-4"><StatusBadge status={run.baselineStatus} /></td>
            <td className="px-4 py-4 text-center font-medium text-emerald-300">{run.summary.passed}</td>
            <td className="px-4 py-4 text-center font-medium text-rose-300">{run.summary.failed}</td>
            <td className="px-4 py-4 text-center font-medium text-amber-300">{run.summary.needsReview}</td>
            <td className="px-4 py-4 text-center font-medium text-red-300">{run.summary.errors}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

