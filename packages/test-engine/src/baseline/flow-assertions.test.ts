import { describe, expect, it } from "vitest";

import type { NormalizedFlow } from "@ghostqa/shared";

import {
  assertionsAfterStep,
  orderedFlowAssertions,
  primaryFlowAssertion,
} from "./flow-assertions.js";

const flow: NormalizedFlow = {
  id: "flow",
  name: "Checkpoint flow",
  steps: [
    { id: "first", position: 0, action: "NAVIGATE", path: "/" },
    { id: "second", position: 1, action: "WAIT_FOR_URL", url: "**/next" },
  ],
  assertions: [
    {
      id: "later",
      afterStepId: "second",
      assertion: { kind: "TEXT_VISIBLE", text: "Finished" },
    },
    {
      id: "intermediate",
      afterStepId: "first",
      assertion: { kind: "TEXT_VISIBLE", text: "Ready" },
    },
  ],
  successAssertion: { kind: "URL_MATCHES", value: "**/next" },
};

describe("flow assertion ordering", () => {
  it("attaches assertions to intermediate steps and keeps the legacy final assertion last", () => {
    expect(assertionsAfterStep(flow.assertions, "first").map(({ id }) => id)).toEqual([
      "intermediate",
    ]);
    expect(orderedFlowAssertions(flow).map(({ id }) => id)).toEqual([
      "intermediate",
      "later",
      "final-success-assertion",
    ]);
    expect(primaryFlowAssertion(flow)).toEqual(flow.successAssertion);
  });

  it("uses the last step-bound assertion when no final assertion exists", () => {
    const { successAssertion: _legacyAssertion, ...checkpointOnly } = flow;
    expect(primaryFlowAssertion(checkpointOnly)).toEqual(
      checkpointOnly.assertions?.[1]?.assertion,
    );
  });
});
