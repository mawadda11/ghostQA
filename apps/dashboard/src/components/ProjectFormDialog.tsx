import type { ProjectSummary } from "@ghostqa/shared";
import { useState } from "react";

import type { ProjectDraft } from "../api/projects.js";
import { ApiClientError } from "../api/client.js";
import { DialogFrame } from "./DialogFrame.js";

export interface ProjectFormValues {
  name: string;
  description: string;
  baseUrl: string;
}

export const validateProjectForm = (
  values: ProjectFormValues,
): Partial<Record<keyof ProjectFormValues, string>> => {
  const errors: Partial<Record<keyof ProjectFormValues, string>> = {};
  if (values.name.trim().length === 0) errors.name = "Project name is required.";
  if (values.baseUrl.trim().length === 0) {
    errors.baseUrl = "Target base URL is required.";
  } else {
    try {
      const url = new URL(values.baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.baseUrl = "Target base URL must use HTTP or HTTPS.";
      }
    } catch {
      errors.baseUrl = "Enter a valid absolute target URL.";
    }
  }
  if (values.description.length > 2_000) {
    errors.description = "Description must be 2,000 characters or fewer.";
  }
  return errors;
};

export const ProjectFormDialog = ({
  project,
  onClose,
  onSubmit,
}: {
  project?: ProjectSummary;
  onClose: () => void;
  onSubmit: (draft: ProjectDraft) => Promise<void>;
}) => {
  const [values, setValues] = useState<ProjectFormValues>({
    name: project?.name ?? "",
    description: project?.description ?? "",
    baseUrl: project?.baseUrl ?? "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ProjectFormValues, string>>
  >({});
  const [requestError, setRequestError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof ProjectFormValues, value: string): void => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const nextErrors = validateProjectForm(values);
    setErrors(nextErrors);
    setRequestError(undefined);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        baseUrl: values.baseUrl.trim(),
        ...(values.description.trim().length === 0
          ? {}
          : { description: values.description.trim() }),
      });
    } catch (error) {
      setRequestError(
        error instanceof ApiClientError
          ? error.message
          : "GhostQA could not save this project.",
      );
      setSubmitting(false);
    }
  };

  const inputClasses =
    "mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10";

  return (
    <DialogFrame
      description="Targets must be localhost or an explicitly allowlisted staging host."
      onClose={submitting ? () => undefined : onClose}
      title={project === undefined ? "Create project" : "Edit project"}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="space-y-5 px-5 py-6 sm:px-6">
          <label className="block text-sm font-medium text-slate-200">
            Project name
            <input
              autoFocus
              className={inputClasses}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Checkout application"
              value={values.name}
            />
            {errors.name === undefined ? null : (
              <span className="mt-1.5 block text-xs text-rose-300">{errors.name}</span>
            )}
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Description <span className="font-normal text-slate-500">(optional)</span>
            <textarea
              className={`${inputClasses} min-h-24 resize-y`}
              onChange={(event) => update("description", event.target.value)}
              placeholder="What this target and its critical journey cover"
              value={values.description}
            />
            {errors.description === undefined ? null : (
              <span className="mt-1.5 block text-xs text-rose-300">{errors.description}</span>
            )}
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Target base URL
            <input
              className={`${inputClasses} font-mono`}
              onChange={(event) => update("baseUrl", event.target.value)}
              placeholder="http://127.0.0.1:4173"
              type="url"
              value={values.baseUrl}
            />
            {errors.baseUrl === undefined ? null : (
              <span className="mt-1.5 block text-xs text-rose-300">{errors.baseUrl}</span>
            )}
          </label>
          {requestError === undefined ? null : (
            <p className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200" role="alert">
              {requestError}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4 sm:px-6">
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800" disabled={submitting} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">
            {submitting ? "Saving…" : project === undefined ? "Create project" : "Save changes"}
          </button>
        </footer>
      </form>
    </DialogFrame>
  );
};

