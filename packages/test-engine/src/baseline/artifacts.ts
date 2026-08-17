import path from "node:path";

export interface ExecutionArtifactPaths {
  directory: string;
  screenshot: string;
  trace: string;
}

export const createExecutionArtifactPaths = (
  artifactDirectory: string,
): ExecutionArtifactPaths => {
  if (artifactDirectory.trim().length === 0) {
    throw new Error("An execution artifact directory is required.");
  }

  const directory = path.resolve(artifactDirectory);

  return {
    directory,
    screenshot: path.join(directory, "screenshot.png"),
    trace: path.join(directory, "trace.zip"),
  };
};

export const createBaselineArtifactPaths = createExecutionArtifactPaths;
