import type {
  SuccessAssertion,
  SuccessAssertionResult,
} from "@ghostqa/shared";
import type { Locator, Page } from "playwright";

import { resolveLocator } from "./locators.js";

const DEFAULT_ASSERTION_TIMEOUT_MS = 10_000;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const visibleTextLocator = (
  page: Page,
  assertion: Extract<SuccessAssertion, { kind: "TEXT_VISIBLE" }>,
): Locator => {
  if (assertion.locator === undefined) {
    return page.getByText(assertion.text, {
      exact: assertion.exact ?? false,
    });
  }

  return resolveLocator(page, assertion.locator).getByText(assertion.text, {
    exact: assertion.exact ?? false,
  });
};

export const evaluateSuccessAssertion = async (
  page: Page,
  assertion: SuccessAssertion,
): Promise<SuccessAssertionResult> => {
  const timeout = assertion.timeoutMs ?? DEFAULT_ASSERTION_TIMEOUT_MS;

  try {
    switch (assertion.kind) {
      case "URL_MATCHES":
        await page.waitForURL(assertion.value, { timeout });
        break;
      case "ELEMENT_VISIBLE":
        await resolveLocator(page, assertion.locator).waitFor({
          state: "visible",
          timeout,
        });
        break;
      case "TEXT_VISIBLE":
        await visibleTextLocator(page, assertion).waitFor({
          state: "visible",
          timeout,
        });
        break;
    }

    return {
      assertion,
      status: "PASSED",
      detail: "The configured success assertion was satisfied.",
    };
  } catch (error) {
    return {
      assertion,
      status: "FAILED",
      detail: errorMessage(error),
    };
  }
};
