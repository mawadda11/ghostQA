import type { NormalizedFlow } from "@ghostqa/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  createFlow,
  getProject,
  listProjectFlows,
  updateProject,
} from "../api/projects.js";
import { startCapture } from "../api/capture.js";
import { listProjectRuns } from "../api/runs.js";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState.js";
import { JsonImportDialog } from "../components/JsonImportDialog.js";
import { PageHeader } from "../components/PageHeader.js";
import { ProjectFormDialog } from "../components/ProjectFormDialog.js";
import { RunTable } from "../components/RunTable.js";
import { formatDateTime } from "../utils/presentation.js";

export const ProjectDetailPage = () => {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [importingFlow, setImportingFlow] = useState(false);
  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId), enabled: projectId.length > 0 });
  const flows = useQuery({ queryKey: ["project-flows", projectId], queryFn: () => listProjectFlows(projectId), enabled: projectId.length > 0 });
  const runs = useQuery({ queryKey: ["project-runs", projectId], queryFn: () => listProjectRuns(projectId), enabled: projectId.length > 0 });
  const updateMutation = useMutation({
    mutationFn: (draft: Parameters<typeof updateProject>[1]) => updateProject(projectId, draft),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      setEditing(false);
    },
  });
  const flowMutation = useMutation({
    mutationFn: (flow: NormalizedFlow) => createFlow(projectId, flow),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["project-flows", projectId] });
      setImportingFlow(false);
      navigate(`/flows/${created.id}`);
    },
  });
  const captureMutation = useMutation({
    mutationFn: () => startCapture(projectId),
    onSuccess: (session) =>
      navigate(`/projects/${projectId}/capture/${session.id}`),
  });

  if (project.isPending || flows.isPending || runs.isPending) return <LoadingState label="Loading project…" />;
  if (project.isError || flows.isError || runs.isError) {
    return <ErrorState error={project.error ?? flows.error ?? runs.error} onRetry={() => { void project.refetch(); void flows.refetch(); void runs.refetch(); }} />;
  }
  const captureLabel =
    flows.data.length === 0 ? "Capture first flow" : "Capture another flow";

  return (
    <div className="space-y-8">
      <div className="text-sm text-slate-500"><Link className="hover:text-cyan-300" to="/projects">Projects</Link><span className="px-2">/</span><span className="text-slate-300">{project.data.name}</span></div>
      <PageHeader
        actions={<><button className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-slate-600" onClick={() => setEditing(true)} type="button">Edit project</button><button className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-cyan-300/40" onClick={() => setImportingFlow(true)} type="button">Advanced / Import baseline JSON</button><button className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-50" disabled={captureMutation.isPending} onClick={() => captureMutation.mutate()} type="button">{captureMutation.isPending ? "Opening Chromium…" : captureLabel}</button></>}
        description={project.data.description ?? "No project description provided."}
        eyebrow="Project"
        title={project.data.name}
      />

      {captureMutation.isError ? <ErrorState error={captureMutation.error} title="Baseline capture could not start" /> : null}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Target base URL</p>
          <p className="mt-3 break-all font-mono text-sm text-cyan-200">{project.data.baseUrl}</p>
        </article>
        <article className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-900/55 p-5">
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Flows</p><p className="mt-2 text-2xl font-semibold text-white">{project.data.flowCount}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Persisted runs</p><p className="mt-2 text-2xl font-semibold text-white">{project.data.runCount}</p></div>
        </article>
      </section>

      <section className="space-y-4" aria-labelledby="flows-heading">
        <div><h2 className="text-lg font-semibold text-white" id="flows-heading">Baseline flows</h2><p className="mt-1 text-sm text-slate-500">Normalized known-good journeys registered for this target.</p></div>
        {flows.data.length === 0 ? (
          <EmptyState action={<div className="flex flex-wrap justify-center gap-2"><button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50" disabled={captureMutation.isPending} onClick={() => captureMutation.mutate()} type="button">{captureLabel}</button><button className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200" onClick={() => setImportingFlow(true)} type="button">Advanced / Import baseline JSON</button></div>} message="Open a controlled Chromium window, perform one known-good journey, then review the normalized steps before saving it to this project." title="No baseline flows registered" />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {flows.data.map((flow) => (
              <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5" key={flow.id}>
                <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-white">{flow.name}</h3><p className="mt-2 text-sm text-slate-500">{flow.stepCount} steps · {flow.scenarioCount} scenario instances</p></div><span className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400">Baseline</span></div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4"><span className="text-xs text-slate-500">Updated {formatDateTime(flow.updatedAt)}</span><Link className="text-sm font-medium text-cyan-300 hover:text-cyan-200" to={`/flows/${flow.id}`}>Open flow →</Link></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="project-runs-heading">
        <div><h2 className="text-lg font-semibold text-white" id="project-runs-heading">Recent runs</h2><p className="mt-1 text-sm text-slate-500">Persisted execution history for this project.</p></div>
        {runs.data.length === 0 ? <EmptyState message="Open a configured flow to start the first real browser run." title="No test runs yet" /> : <RunTable runs={runs.data.slice(0, 5)} />}
      </section>

      {editing ? <ProjectFormDialog onClose={() => setEditing(false)} onSubmit={(draft) => updateMutation.mutateAsync(draft).then(() => undefined)} project={project.data} /> : null}
      {importingFlow ? <JsonImportDialog kind="flow" onClose={() => setImportingFlow(false)} onImport={(value) => flowMutation.mutateAsync(value as NormalizedFlow).then(() => undefined)} /> : null}
    </div>
  );
};
