import type { FlowStep } from "@ghostqa/shared";
import type { Page } from "playwright";

import { resolveLocator } from "./locators.js";

const DEFAULT_STEP_TIMEOUT_MS = 10_000;

export const executeFlowStep = async (
  page: Page,
  baseUrl: string,
  step: FlowStep,
): Promise<void> => {
  const timeout = step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;

  switch (step.action) {
    case "NAVIGATE":
      await page.goto(new URL(step.path, baseUrl).href, {
        waitUntil: "domcontentloaded",
        timeout,
      });
      return;
    case "CLICK":
      await resolveLocator(page, step.locator).click({ timeout });
      return;
    case "FILL":
      await resolveLocator(page, step.locator).fill(step.value, { timeout });
      return;
    case "SELECT_OPTION":
      await resolveLocator(page, step.locator).selectOption(step.value, {
        timeout,
      });
      return;
    case "PRESS":
      await resolveLocator(page, step.locator).press(step.key, { timeout });
      return;
    case "WAIT_FOR_URL":
      await page.waitForURL(step.url, { timeout });
      return;
    case "ASSERT_VISIBLE":
      await resolveLocator(page, step.locator).waitFor({
        state: "visible",
        timeout,
      });
  }
};
