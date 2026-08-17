import path from "node:path";

export interface BaselineArtifactPaths {
  directory: string;
  screenshot: string;
  trace: string;
}

export const createBaselineArtifactPaths = (
  artifactDirectory: string,
): BaselineArtifactPaths => {
  if (artifactDirectory.trim().length === 0) {
    throw new Error("A baseline artifact directory is required.");
  }

  const directory = path.resolve(artifactDirectory);

  return {
    directory,
    screenshot: path.join(directory, "screenshot.png"),
    trace: path.join(directory, "trace.zip"),
  };
};
