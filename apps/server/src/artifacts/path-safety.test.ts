import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  ArtifactPathError,
  resolveStoredArtifactPath,
  toStoredArtifactPath,
} from "./path-safety.js";

describe("artifact path safety", () => {
  const root = path.resolve("artifacts");

  it("stores root-contained paths as normalized relative paths", () => {
    expect(
      toStoredArtifactPath(root, path.join(root, "runs", "one", "trace.zip")),
    ).toBe("runs/one/trace.zip");
  });

  it("rejects generated artifacts outside the configured root", () => {
    expect(() =>
      toStoredArtifactPath(root, path.resolve("outside", "trace.zip")),
    ).toThrowError(ArtifactPathError);
  });

  it("rejects persisted path traversal", () => {
    expect(() => resolveStoredArtifactPath(root, "../secret.txt")).toThrowError(
      ArtifactPathError,
    );
  });

  it("rejects absolute persisted paths", () => {
    expect(() =>
      resolveStoredArtifactPath(root, path.join(root, "trace.zip")),
    ).toThrowError(ArtifactPathError);
  });
});
