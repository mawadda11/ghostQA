import type { ArtifactMetadata } from "@ghostqa/shared";
import { useEffect, useState } from "react";

import { artifactUrl } from "../api/runs.js";

export const ScreenshotViewer = ({
  artifact,
}: {
  artifact: ArtifactMetadata;
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const source = artifactUrl(artifact.id);

  useEffect(() => {
    if (!expanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  if (failed) {
    return (
      <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.05] px-5 py-8 text-center text-sm text-rose-200" role="alert">
        Screenshot unavailable. The artifact may have been moved or removed.
      </div>
    );
  }

  return (
    <>
      <button
        aria-label="Open screenshot at full size"
        className="relative block w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
        onClick={() => setExpanded(true)}
        type="button"
      >
        {loaded ? null : (
          <span className="grid min-h-56 place-items-center text-sm text-slate-500">
            Loading screenshot…
          </span>
        )}
        <img
          alt="Browser screenshot captured by GhostQA"
          className={`h-auto max-h-[38rem] w-full object-contain ${loaded ? "block" : "hidden"}`}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          src={source}
        />
        {loaded ? (
          <span className="absolute bottom-3 right-3 rounded-md border border-white/10 bg-slate-950/90 px-2.5 py-1.5 text-xs font-medium text-slate-200">
            Open larger
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div
          aria-label="Expanded browser screenshot"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-slate-950/95 p-4 sm:p-8"
          onClick={() => setExpanded(false)}
          role="dialog"
        >
          <button
            autoFocus
            className="fixed right-4 top-4 z-10 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => setExpanded(false)}
            type="button"
          >
            Close
          </button>
          <img
            alt="Expanded browser screenshot captured by GhostQA"
            className="h-auto max-w-full rounded-lg border border-slate-700 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            src={source}
          />
        </div>
      ) : null}
    </>
  );
};
