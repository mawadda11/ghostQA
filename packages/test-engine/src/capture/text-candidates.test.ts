import { describe, expect, it } from "vitest";

import type { VisibleTextCandidateObservation } from "./text-candidates.js";
import { selectUsefulTextCandidates } from "./text-candidates.js";

const candidate = (
  text: string,
  overrides: Partial<VisibleTextCandidateObservation> = {},
): VisibleTextCandidateObservation => ({
  text,
  kind: "PROMINENT_TEXT",
  visible: true,
  insideNavigation: false,
  interactive: false,
  ...overrides,
});

describe("success text candidates", () => {
  it("prioritizes status and heading text and removes duplicates", () => {
    expect(
      selectUsefulTextCandidates([
        candidate("Supporting paragraph"),
        candidate("Workflow complete", { kind: "HEADING" }),
        candidate(" workflow   complete ", { kind: "STATUS" }),
        candidate("Saved", { kind: "ALERT" }),
      ]),
    ).toEqual(["Saved", "workflow complete", "Supporting paragraph"]);
  });

  it("filters hidden, navigation, interactive, empty, and giant text", () => {
    expect(
      selectUsefulTextCandidates([
        candidate("Menu", { insideNavigation: true }),
        candidate("Hidden", { visible: false }),
        candidate("Continue", { interactive: true }),
        candidate("x"),
        candidate("a".repeat(161)),
        candidate("Useful status", { kind: "STATUS" }),
      ]),
    ).toEqual(["Useful status"]);
  });
});
