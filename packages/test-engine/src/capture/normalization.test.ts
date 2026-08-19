import { describe, expect, it } from "vitest";

import { normalizeCapturedInteractions } from "./normalization.js";
import type { NormalizeCaptureInput, RawCaptureEvent } from "./types.js";

const role = (roleName: "button" | "textbox", name: string) => ({
  role: { role: roleName, name, unique: true },
});

const inputFor = (
  events: readonly RawCaptureEvent[],
): NormalizeCaptureInput => ({
  baseUrl: "http://127.0.0.1:9000/",
  suggestedFlowId: "captured-flow",
  suggestedFlowName: "Captured baseline",
  events,
  network: [],
  finalUrl: "http://127.0.0.1:9000/complete",
  successTextCandidates: ["Complete", "Complete"],
});

describe("raw capture normalization", () => {
  it("coalesces complete fills and marks password values as sensitive", () => {
    const input = inputFor([
        {
          kind: "FILL",
          order: 0,
          timestampMs: 100,
          pageUrl: "http://127.0.0.1:9000/",
          locator: role("textbox", "Password"),
          value: "partial",
          sensitive: true,
        },
        {
          kind: "FILL",
          order: 1,
          timestampMs: 110,
          pageUrl: "http://127.0.0.1:9000/",
          locator: role("textbox", "Password"),
          value: "complete-secret",
          sensitive: true,
        },
      ]);
    const draft = normalizeCapturedInteractions({
      ...input,
      finalUrl: "http://127.0.0.1:9000/",
    });
    expect(draft.steps).toHaveLength(2);
    expect(draft.steps[1]).toMatchObject({
      action: "FILL",
      value: "complete-secret",
      sensitive: true,
    });
    expect(draft.successTextCandidates).toEqual(["Complete"]);
  });

  it("adds a useful URL boundary after a user action", () => {
    const input = inputFor([
        {
          kind: "CLICK",
          order: 0,
          timestampMs: 100,
          pageUrl: "http://127.0.0.1:9000/",
          locator: role("button", "Continue"),
        },
        {
          kind: "NAVIGATION",
          order: 1,
          timestampMs: 101,
          pageUrl: "http://127.0.0.1:9000/next",
          url: "http://127.0.0.1:9000/next",
        },
        {
          kind: "NAVIGATION",
          order: 2,
          timestampMs: 102,
          pageUrl: "http://127.0.0.1:9000/next",
          url: "http://127.0.0.1:9000/next",
        },
      ]);
    const draft = normalizeCapturedInteractions({
      ...input,
      finalUrl: "http://127.0.0.1:9000/next",
    });
    expect(draft.steps.map((step) => step.action)).toEqual([
      "NAVIGATE",
      "CLICK",
      "WAIT_FOR_URL",
    ]);
    expect(draft.steps[2]).toMatchObject({ url: "**/next" });
  });

  it("wildcards clearly generated URL path identifiers for repeatable replay", () => {
    const input = inputFor([
      {
        kind: "CLICK",
        order: 0,
        timestampMs: 100,
        pageUrl: "http://127.0.0.1:9000/review",
        locator: role("button", "Confirm"),
      },
    ]);
    const draft = normalizeCapturedInteractions({
      ...input,
      finalUrl: "http://127.0.0.1:9000/confirmation/ENR-1002",
    });
    expect(draft.steps.at(-1)).toMatchObject({
      action: "WAIT_FOR_URL",
      url: "**/confirmation/*",
    });
  });

  it("associates and ranks mutation requests without inventing intent", () => {
    const input = inputFor([
      {
        kind: "CLICK",
        order: 0,
        timestampMs: 1_000,
        pageUrl: "http://127.0.0.1:9000/review",
        locator: role("button", "Confirm"),
      },
    ]);
    const draft = normalizeCapturedInteractions({
      ...input,
      network: [
        {
          method: "GET",
          pathname: "/api/options",
          status: 200,
          timestampMs: 1_020,
        },
        {
          method: "POST",
          pathname: "/api/submissions",
          status: 201,
          timestampMs: 1_050,
        },
      ],
    });
    expect(draft.criticalActionCandidates).toEqual([
      {
        stepId: "click-confirm",
        label: "Confirm",
        request: { method: "POST", pathname: "/api/submissions" },
        reason: "A mutation request occurred immediately after this action.",
      },
    ]);
    expect(draft.network[1]?.actionStepId).toBe("click-confirm");
  });

  it("associates a request delivered just before its browser click binding", () => {
    const draft = normalizeCapturedInteractions({
      ...inputFor([
        {
          kind: "CLICK",
          order: 0,
          timestampMs: 1_017,
          pageUrl: "http://127.0.0.1:9000/review",
          locator: role("button", "Confirm"),
        },
      ]),
      network: [
        {
          method: "POST",
          pathname: "/api/submissions",
          status: 201,
          timestampMs: 1_011,
        },
      ],
    });
    expect(draft.criticalActionCandidates[0]).toMatchObject({
      stepId: "click-confirm",
      request: { method: "POST", pathname: "/api/submissions" },
    });
    expect(draft.network[0]?.actionStepId).toBe("click-confirm");
  });

  it("prefers a later journey mutation while retaining earlier candidates", () => {
    const input = inputFor([
      {
        kind: "CLICK",
        order: 0,
        timestampMs: 1_000,
        pageUrl: "http://127.0.0.1:9000/",
        locator: role("button", "Sign in"),
      },
      {
        kind: "CLICK",
        order: 1,
        timestampMs: 2_000,
        pageUrl: "http://127.0.0.1:9000/review",
        locator: role("button", "Confirm"),
      },
    ]);
    const draft = normalizeCapturedInteractions({
      ...input,
      network: [
        { method: "POST", pathname: "/api/session", timestampMs: 1_020 },
        { method: "POST", pathname: "/api/submissions", timestampMs: 2_020 },
      ],
    });
    expect(draft.criticalActionCandidates.map((candidate) => candidate.label)).toEqual([
      "Confirm",
      "Sign in",
    ]);
  });

  it("rejects a capture with no meaningful user action", () => {
    expect(() =>
      normalizeCapturedInteractions(
        inputFor([
          {
            kind: "NAVIGATION",
            order: 0,
            timestampMs: 1,
            pageUrl: "http://127.0.0.1:9000/",
            url: "http://127.0.0.1:9000/",
          },
        ]),
      ),
    ).toThrow(/without any meaningful user interactions/);
  });

  it("identifies the exact raw event when a manual click has no stable locator", () => {
    expect(() =>
      normalizeCapturedInteractions(
        inputFor([
          {
            kind: "CLICK",
            order: 7,
            timestampMs: 2_000,
            pageUrl: "http://127.0.0.1:9000/review",
            locator: {},
          },
        ]),
      ),
    ).toThrow("Captured click event 7 on /review had no stable unique locator.");
  });
});
