import type { ConsoleObservation } from "@ghostqa/shared";
import { describe, expect, it } from "vitest";

import { consoleEvidenceEntries, createEvidenceEntry } from "./evidence.js";

describe("scenario evidence helpers", () => {
  it("creates timestamped structured evidence without generated prose", () => {
    const entry = createEvidenceEntry(
      "SCENARIO_INJECTION",
      "Injected HTTP 500 response.",
      { status: 500 },
    );

    expect(entry.type).toBe("SCENARIO_INJECTION");
    expect(entry.metadata).toEqual({ status: 500 });
    expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
  });

  it("preserves console and page-error source types", () => {
    const observations: ConsoleObservation[] = [
      {
        source: "CONSOLE",
        level: "error",
        text: "console failure",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        source: "PAGE_ERROR",
        level: "error",
        text: "page failure",
        timestamp: "2026-01-01T00:00:01.000Z",
      },
    ];

    expect(consoleEvidenceEntries(observations).map((entry) => entry.type)).toEqual([
      "CONSOLE_ERROR",
      "PAGE_ERROR",
    ]);
  });
});
