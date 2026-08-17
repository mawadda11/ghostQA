import path from "node:path";

import { describe, expect, it } from "vitest";

import { createBaselineArtifactPaths } from "./artifacts.js";

describe("createBaselineArtifactPaths", () => {
  it("creates predictable screenshot and trace paths", () => {
    const result = createBaselineArtifactPaths(
      path.join("artifacts", "sample-app", "run-1", "baseline"),
    );

    expect(result.screenshot).toBe(
      path.join(result.directory, "screenshot.png"),
    );
    expect(result.trace).toBe(path.join(result.directory, "trace.zip"));
  });

  it("rejects an empty artifact directory", () => {
    expect(() => createBaselineArtifactPaths("  ")).toThrowError(
      /artifact directory/,
    );
  });
});
