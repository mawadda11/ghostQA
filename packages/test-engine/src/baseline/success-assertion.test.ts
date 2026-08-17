import type { Page } from "playwright";
import { describe, expect, it, vi } from "vitest";

import { evaluateSuccessAssertion } from "./success-assertion.js";

describe("evaluateSuccessAssertion", () => {
  it("passes when configured text becomes visible", async () => {
    const waitFor = vi.fn().mockResolvedValue(undefined);
    const page = {
      getByText: vi.fn().mockReturnValue({ waitFor }),
    } as unknown as Page;

    const result = await evaluateSuccessAssertion(page, {
      kind: "TEXT_VISIBLE",
      text: "Checkout complete",
      exact: true,
    });

    expect(result.status).toBe("PASSED");
    expect(waitFor).toHaveBeenCalledWith({
      state: "visible",
      timeout: 10_000,
    });
  });

  it("returns a failed assertion without inventing success", async () => {
    const page = {
      waitForURL: vi.fn().mockRejectedValue(new Error("URL did not match")),
    } as unknown as Page;

    const result = await evaluateSuccessAssertion(page, {
      kind: "URL_MATCHES",
      value: "**/confirmation/**",
    });

    expect(result).toMatchObject({
      status: "FAILED",
      detail: "URL did not match",
    });
  });
});
