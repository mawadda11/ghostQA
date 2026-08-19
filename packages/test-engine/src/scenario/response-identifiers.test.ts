import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  inferResponseIdentifierProof,
  readSmallJsonResponse,
} from "./response-identifiers.js";

describe("response identifier inference", () => {
  it("proves distinct generated identifiers without persisting their values", () => {
    const proof = inferResponseIdentifierProof([
      { entityReference: "ST-501", title: "A" },
      { entityReference: "ST-502", title: "A" },
    ], { capturedInputValues: ["A"] });
    expect(proof).toMatchObject({
      field: "entityReference",
      source: "INFERRED",
      distinctCount: 2,
    });
    expect(JSON.stringify(proof)).not.toContain("ST-501");
    expect(JSON.stringify(proof)).not.toContain("A");
  });

  it("does not treat the same identifier as duplicate-entity proof", () => {
    expect(
      inferResponseIdentifierProof([{ id: 42 }, { id: 42 }]),
    ).toMatchObject({ field: "id", distinctCount: 1 });
  });

  it("prefers a distinct entity identifier over a stable foreign identifier", () => {
    expect(
      inferResponseIdentifierProof([
        { id: "ENR-1001", courseId: "course-101" },
        { id: "ENR-1002", courseId: "course-101" },
      ]),
    ).toMatchObject({ field: "id", distinctCount: 2 });
  });

  it("rejects payloads without a high-confidence identifier", () => {
    expect(
      inferResponseIdentifierProof([
        { status: "saved", title: "First" },
        { status: "saved", title: "Second" },
      ]),
    ).toEqual({ fingerprints: [], distinctCount: 0 });
  });

  it("rejects timestamp-only differences", () => {
    expect(
      inferResponseIdentifierProof([
        { createdAt: "2026-08-18T10:00:00.000Z" },
        { createdAt: "2026-08-18T10:00:01.000Z" },
      ]),
    ).toEqual({ fingerprints: [], distinctCount: 0 });
  });

  it("handles non-JSON responses conservatively", async () => {
    const payload = await readSmallJsonResponse({
      headers: () => ({ "content-type": "text/plain" }),
      body: async () => Buffer.from("id=secret"),
    });
    expect(payload).toBeUndefined();
  });

  it("rejects echoed captured input even when its field looks identifier-like", () => {
    const proof = inferResponseIdentifierProof(
      [{ id: "private-input" }, { id: "private-input" }],
      { capturedInputValues: ["private-input"] },
    );
    expect(proof).toEqual({ fingerprints: [], distinctCount: 0 });
  });
});
