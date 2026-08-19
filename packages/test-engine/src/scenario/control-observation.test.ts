import { describe, expect, it } from "vitest";

import {
  controlStateEvidence,
  isStablePendingControl,
} from "./control-observation.js";

describe("critical control evidence", () => {
  it("describes a safe pending state without exposing control text", () => {
    const before = {
      attached: true,
      visible: true,
      enabled: true,
      ariaBusy: false,
      textFingerprint: "before-hash",
    };
    const during = {
      attached: true,
      visible: true,
      enabled: true,
      ariaBusy: true,
      textFingerprint: "during-hash",
    };
    expect(isStablePendingControl(during)).toBe(true);
    const evidence = controlStateEvidence(
      "Observed the critical control during the delayed request.",
      before,
      during,
    );
    expect(evidence.metadata).toMatchObject({
      duringVisible: true,
      duringEnabled: true,
      duringAriaBusy: true,
      textChanged: true,
    });
    expect(JSON.stringify(evidence)).not.toContain("before-hash");
    expect(JSON.stringify(evidence)).not.toContain("during-hash");
  });
});
