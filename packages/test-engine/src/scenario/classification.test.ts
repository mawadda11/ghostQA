import { describe, expect, it } from "vitest";

import {
  classifyApiFailure,
  classifyDoubleAction,
  classifyNavigation,
  classifySessionExpiry,
  classifySlowResponse,
} from "./classification.js";

describe("classifyDoubleAction", () => {
  it("fails confirmed duplicate mutations with distinct identifiers", () => {
    expect(
      classifyDoubleAction({
        successfulMutationCount: 2,
        distinctIdentifierCount: 2,
        assertionPassed: true,
      }).status,
    ).toBe("FAIL");
  });

  it("requests review when duplicate uniqueness is unknown", () => {
    expect(
      classifyDoubleAction({
        successfulMutationCount: 2,
        distinctIdentifierCount: 0,
        assertionPassed: true,
      }).status,
    ).toBe("NEEDS_REVIEW");
  });

  it("passes one successful mutation with a passing assertion", () => {
    expect(
      classifyDoubleAction({
        successfulMutationCount: 1,
        distinctIdentifierCount: 1,
        assertionPassed: true,
      }).status,
    ).toBe("PASS");
  });
});

describe("classifyApiFailure", () => {
  it("fails a deterministic broken state after an injected failure", () => {
    expect(
      classifyApiFailure({
        injectedFailureObserved: true,
        brokenStateMatched: true,
        recoveryStateMatched: false,
        assertionPassed: false,
      }).status,
    ).toBe("FAIL");
  });

  it("passes a configured recovery state", () => {
    expect(
      classifyApiFailure({
        injectedFailureObserved: true,
        brokenStateMatched: false,
        recoveryStateMatched: true,
        assertionPassed: false,
      }).status,
    ).toBe("PASS");
  });

  it("uses review for inconclusive recovery", () => {
    expect(
      classifyApiFailure({
        injectedFailureObserved: true,
        brokenStateMatched: false,
        recoveryStateMatched: false,
        assertionPassed: false,
      }).status,
    ).toBe("NEEDS_REVIEW");
  });
});

describe("classifySlowResponse", () => {
  it("passes protected action behavior that completes", () => {
    expect(
      classifySlowResponse({
        successfulMutationCount: 1,
        assertionPassed: true,
        repeatabilityMatched: false,
        preventionMatched: true,
      }).status,
    ).toBe("PASS");
  });

  it("requests review for an available action without duplicate mutation", () => {
    expect(
      classifySlowResponse({
        successfulMutationCount: 1,
        assertionPassed: true,
        repeatabilityMatched: true,
        preventionMatched: false,
      }).status,
    ).toBe("NEEDS_REVIEW");
  });

  it("fails unexpected duplicate mutations", () => {
    expect(
      classifySlowResponse({
        successfulMutationCount: 2,
        assertionPassed: true,
        repeatabilityMatched: true,
        preventionMatched: false,
      }).status,
    ).toBe("FAIL");
  });
});

describe("classifyNavigation", () => {
  it("fails configured state loss after refresh", () => {
    expect(
      classifyNavigation({
        stateMatched: false,
        urlMatched: true,
        mutationCount: 0,
        mode: "REFRESH",
      }).status,
    ).toBe("FAIL");
  });

  it("passes preserved state after back navigation", () => {
    expect(
      classifyNavigation({
        stateMatched: true,
        urlMatched: true,
        mutationCount: 0,
        mode: "BACK",
      }).status,
    ).toBe("PASS");
  });

  it("fails an accidental navigation mutation", () => {
    expect(
      classifyNavigation({
        stateMatched: true,
        urlMatched: true,
        mutationCount: 1,
        mode: "BACK",
      }).status,
    ).toBe("FAIL");
  });
});

describe("classifySessionExpiry", () => {
  it("fails a broken state after an unauthorized response", () => {
    expect(
      classifySessionExpiry({
        invalidationObserved: true,
        unauthorizedObserved: true,
        brokenStateMatched: true,
        recoveryStateMatched: false,
        assertionPassed: false,
      }).status,
    ).toBe("FAIL");
  });

  it("passes configured authentication recovery", () => {
    expect(
      classifySessionExpiry({
        invalidationObserved: true,
        unauthorizedObserved: true,
        brokenStateMatched: false,
        recoveryStateMatched: true,
        assertionPassed: false,
      }).status,
    ).toBe("PASS");
  });

  it("uses review when invalidation is not confirmed", () => {
    expect(
      classifySessionExpiry({
        invalidationObserved: false,
        unauthorizedObserved: false,
        brokenStateMatched: false,
        recoveryStateMatched: false,
        assertionPassed: false,
      }).status,
    ).toBe("NEEDS_REVIEW");
  });
});
