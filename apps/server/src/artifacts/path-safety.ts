import { realpath } from "node:fs/promises";
import path from "node:path";

export class ArtifactPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactPathError";
  }
}

const assertContained = (root: string, candidate: string): string => {
  const relative = path.relative(root, candidate);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new ArtifactPathError(
      "Artifact path must resolve to a file inside the configured artifact root.",
    );
  }
  return relative;
};

export const toStoredArtifactPath = (
  artifactRoot: string,
  absolutePath: string,
): string => {
  const root = path.resolve(artifactRoot);
  const candidate = path.resolve(absolutePath);
  return assertContained(root, candidate).split(path.sep).join("/");
};

export const resolveStoredArtifactPath = (
  artifactRoot: string,
  storedPath: string,
): string => {
  if (path.isAbsolute(storedPath)) {
    throw new ArtifactPathError("Persisted artifact paths must be relative.");
  }
  const root = path.resolve(artifactRoot);
  const candidate = path.resolve(root, storedPath);
  assertContained(root, candidate);
  return candidate;
};

/**
 * Resolves both paths through the filesystem before checking containment so a
 * symlink stored below the artifact root cannot point at an external file.
 */
export const resolveExistingStoredArtifactPath = async (
  artifactRoot: string,
  storedPath: string,
): Promise<string> => {
  const candidate = resolveStoredArtifactPath(artifactRoot, storedPath);
  const [realRoot, realCandidate] = await Promise.all([
    realpath(path.resolve(artifactRoot)),
    realpath(candidate),
  ]);
  assertContained(realRoot, realCandidate);
  return realCandidate;
};
