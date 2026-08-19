import { describe, expect, it } from "vitest";

import { CaptureNormalizationError, selectStableLocator } from "./locators.js";

describe("capture locator generation", () => {
  it("uses the documented semantic priority", () => {
    expect(
      selectStableLocator({
        role: { role: "button", name: "Publish", unique: true },
        label: { text: "Publish story", unique: true },
        testId: { value: "publish", unique: true },
        text: { text: "Publish", unique: true },
        css: { selector: "#publish", unique: true },
      }),
    ).toEqual({
      kind: "ROLE",
      role: "button",
      name: "Publish",
      exact: true,
    });
  });

  it("falls back through label, test id, text, and stable CSS", () => {
    expect(
      selectStableLocator({
        role: { role: "textbox", name: "Email", unique: false },
        label: { text: "Email", unique: true },
      }),
    ).toEqual({ kind: "LABEL", text: "Email", exact: true });
    expect(
      selectStableLocator({
        testId: { value: "story-title", unique: true },
        text: { text: "Title", unique: true },
      }),
    ).toEqual({ kind: "TEST_ID", value: "story-title" });
    expect(
      selectStableLocator({ text: { text: "Continue", unique: true } }),
    ).toEqual({ kind: "TEXT", text: "Continue", exact: true });
    expect(
      selectStableLocator({ css: { selector: "#stable-id", unique: true } }),
    ).toEqual({ kind: "CSS", selector: "#stable-id" });
  });

  it("rejects an interaction without a unique stable locator", () => {
    expect(() =>
      selectStableLocator({
        role: { role: "button", name: "Continue", unique: false },
        css: { selector: ".generated-123", unique: false },
      }),
    ).toThrow(CaptureNormalizationError);
  });
});

