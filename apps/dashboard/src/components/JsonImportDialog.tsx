import type { NormalizedFlow, ScenarioDefinition } from "@ghostqa/shared";
import { useState } from "react";

import { ApiClientError } from "../api/client.js";
import { DialogFrame } from "./DialogFrame.js";

const flowExample = `{
  "id": "submission-flow",
  "name": "Known-good submission",
  "steps": [
    { "id": "open", "position": 0, "action": "NAVIGATE", "path": "/" },
    { "id": "submit", "position": 1, "action": "CLICK", "locator": { "kind": "ROLE", "role": "button", "name": "Submit" } }
  ],
  "criticalAction": { "stepId": "submit", "label": "Submit" },
  "successAssertion": { "kind": "TEXT_VISIBLE", "text": "Complete" }
}`;

const scenarioExample = `[
  {
    "id": "double-action",
    "name": "Double Action",
    "family": "DOUBLE_ACTION",
    "config": { "family": "DOUBLE_ACTION" }
  }
]`;

interface JsonImportDialogProps {
  kind: "flow" | "scenarios";
  onClose: () => void;
  onImport: (
    value: NormalizedFlow | readonly ScenarioDefinition[],
  ) => Promise<void>;
}

export const JsonImportDialog = ({
  kind,
  onClose,
  onImport,
}: JsonImportDialogProps) => {
  const [value, setValue] = useState(
    kind === "flow" ? flowExample : scenarioExample,
  );
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(undefined);
    let parsed: unknown;
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      setError("The pasted value is not valid JSON.");
      return;
    }
    if (kind === "flow" && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))) {
      setError("A normalized flow must be a JSON object.");
      return;
    }
    if (kind === "scenarios" && !Array.isArray(parsed)) {
      setError("A scenario plan must be a JSON array.");
      return;
    }
    setSubmitting(true);
    try {
      await onImport(
        parsed as NormalizedFlow | readonly ScenarioDefinition[],
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiClientError
          ? requestError.message
          : `GhostQA could not import this ${kind === "flow" ? "flow" : "scenario plan"}.`,
      );
      setSubmitting(false);
    }
  };

  return (
    <DialogFrame
      description={
        kind === "flow"
          ? "Paste the normalized V1 flow produced by your Playwright/codegen normalization workflow."
          : "Paste explicit definitions for the supported V1 scenario families. The server validates every configuration."
      }
      onClose={submitting ? () => undefined : onClose}
      title={kind === "flow" ? "Register normalized flow" : "Import scenario plan"}
    >
      <form onSubmit={(event) => void submit(event)}>
        <div className="px-5 py-6 sm:px-6">
          <label className="block text-sm font-medium text-slate-200">
            {kind === "flow" ? "Normalized flow JSON" : "Scenario definitions JSON"}
            <textarea
              aria-describedby="json-help"
              autoFocus
              className="mt-2 min-h-80 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/10"
              onChange={(event) => setValue(event.target.value)}
              spellCheck={false}
              value={value}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-slate-500" id="json-help">
            Configuration is data only. Executable scripts and browser hooks are not accepted.
          </p>
          {error === undefined ? null : (
            <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-4 sm:px-6">
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800" disabled={submitting} onClick={onClose} type="button">
            Cancel
          </button>
          <button className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60" disabled={submitting} type="submit">
            {submitting ? "Validating…" : "Import"}
          </button>
        </footer>
      </form>
    </DialogFrame>
  );
};
