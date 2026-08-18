import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { createProject, listProjects } from "../api/projects.js";
import { listRuns } from "../api/runs.js";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState.js";
import { PageHeader } from "../components/PageHeader.js";
import { ProjectFormDialog } from "../components/ProjectFormDialog.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { formatDateTime } from "../utils/presentation.js";

export const ProjectsPage = () => {
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const runs = useQuery({ queryKey: ["runs"], queryFn: listRuns });
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setCreating(false);
    },
  });

  if (projects.isPending || runs.isPending) return <LoadingState label="Loading projects…" />;
  if (projects.isError || runs.isError) {
    return (
      <ErrorState
        error={projects.error ?? runs.error}
        onRetry={() => {
          void projects.refetch();
          void runs.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        actions={<button className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-200" onClick={() => setCreating(true)} type="button">Create project</button>}
        description="Allowlisted target applications and the baseline journeys GhostQA can execute."
        eyebrow="Configuration"
        title="Projects"
      />

      {projects.data.length === 0 ? (
        <EmptyState
          action={<button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" onClick={() => setCreating(true)} type="button">Create your first project</button>}
          message="Add a localhost or explicitly allowlisted staging target to begin."
          title="No projects yet"
        />
      ) : (
        <section className="grid gap-4 xl:grid-cols-2" aria-label="Projects">
          {projects.data.map((project) => {
            const lastRun = runs.data.find((run) => run.projectId === project.id);
            return (
              <article className="rounded-xl border border-slate-800 bg-slate-900/55 p-5 sm:p-6" key={project.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">{project.name}</h2>
                    <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{project.description ?? "No description provided."}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-slate-400">{project.flowCount} {project.flowCount === 1 ? "flow" : "flows"}</span>
                </div>
                <p className="mt-5 truncate rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 font-mono text-xs text-slate-300" title={project.baseUrl}>{project.baseUrl}</p>
                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-xs">
                  <div>
                    <dt className="text-slate-500">Last run</dt>
                    <dd className="mt-1.5">{lastRun === undefined ? <span className="text-slate-400">No runs yet</span> : <StatusBadge status={lastRun.status} />}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Updated</dt>
                    <dd className="mt-2 text-slate-300">{formatDateTime(project.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{project.runCount} persisted {project.runCount === 1 ? "run" : "runs"}</span>
                  <Link className="rounded-lg border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-200 hover:border-cyan-300/40 hover:text-cyan-200" to={`/projects/${project.id}`}>Open project</Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {creating ? (
        <ProjectFormDialog
          onClose={() => setCreating(false)}
          onSubmit={(draft) => createMutation.mutateAsync(draft).then(() => undefined)}
        />
      ) : null}
    </div>
  );
};

