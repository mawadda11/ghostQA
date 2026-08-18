import path from "node:path";

import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";

import { describe, expect, it } from "vitest";

import {
  ArtifactPathError,
  resolveExistingStoredArtifactPath,
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

  it("resolves an existing file only after filesystem containment checks", async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ghostqa-artifacts-"));
    try {
      const nestedDirectory = path.join(temporaryRoot, "runs", "one");
      await mkdir(nestedDirectory, { recursive: true });
      const artifact = path.join(nestedDirectory, "trace.zip");
      await writeFile(artifact, "trace");

      await expect(
        resolveExistingStoredArtifactPath(temporaryRoot, "runs/one/trace.zip"),
      ).resolves.toBe(await realpath(artifact));
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("rejects a stored symlink that resolves outside the artifact root", async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "ghostqa-artifact-link-"),
    );
    try {
      const artifactRoot = path.join(temporaryDirectory, "artifacts");
      const outside = path.join(temporaryDirectory, "outside");
      await Promise.all([
        mkdir(artifactRoot, { recursive: true }),
        mkdir(outside, { recursive: true }),
      ]);
      await writeFile(path.join(outside, "secret.txt"), "not an artifact");
      await symlink(
        outside,
        path.join(artifactRoot, "escaped"),
        process.platform === "win32" ? "junction" : "dir",
      );

      await expect(
        resolveExistingStoredArtifactPath(
          artifactRoot,
          "escaped/secret.txt",
        ),
      ).rejects.toThrowError(ArtifactPathError);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
