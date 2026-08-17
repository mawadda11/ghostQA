import type {
  ElementObservation,
  EvidenceEntry,
  JsonValue,
} from "@ghostqa/shared";
import type { Locator, Page } from "playwright";

import { resolveLocator } from "../baseline/locators.js";
import { createEvidenceEntry } from "./evidence.js";

const DEFAULT_OBSERVATION_TIMEOUT_MS = 1_000;

export interface ElementObservationResult {
  matched: boolean;
  detail: string;
  actual?: JsonValue;
  evidence: EvidenceEntry;
}

const observeAttribute = async (
  locator: Locator,
  observation: ElementObservation,
  timeout: number,
): Promise<{ matched: boolean; actual: string | null }> => {
  await locator.waitFor({ state: "attached", timeout });
  const attribute = observation.attribute ?? "";
  const expected = observation.value ?? "";
  const stableForMs = observation.stableForMs ?? 0;

  const matched = await locator.evaluate(
    (element, input) =>
      new Promise<boolean>((resolve) => {
        const matches = (): boolean =>
          element.getAttribute(input.attribute) === input.expected;
        let stableTimer: ReturnType<typeof setTimeout> | undefined;
        const finish = (value: boolean): void => {
          observer.disconnect();
          clearTimeout(timeoutTimer);
          if (stableTimer !== undefined) clearTimeout(stableTimer);
          resolve(value);
        };
        const beginStablePeriod = (): void => {
          if (!matches()) return;
          if (input.stableForMs === 0) {
            finish(true);
            return;
          }
          stableTimer ??= setTimeout(() => finish(matches()), input.stableForMs);
        };
        const observer = new MutationObserver(() => {
          if (!matches() && stableTimer !== undefined) {
            clearTimeout(stableTimer);
            stableTimer = undefined;
          }
          beginStablePeriod();
        });
        const timeoutTimer = setTimeout(() => finish(false), input.timeoutMs);
        observer.observe(element, { attributes: true });
        beginStablePeriod();
      }),
    { attribute, expected, stableForMs, timeoutMs: timeout },
  );

  return { matched, actual: await locator.getAttribute(attribute) };
};

export const observeElement = async (
  page: Page,
  observation: ElementObservation,
): Promise<ElementObservationResult> => {
  const locator = resolveLocator(page, observation.locator);
  const timeout = observation.timeoutMs ?? DEFAULT_OBSERVATION_TIMEOUT_MS;
  let matched = false;
  let actual: JsonValue | undefined;

  try {
    switch (observation.state) {
      case "VISIBLE":
        await locator.waitFor({ state: "visible", timeout });
        matched = true;
        actual = "visible";
        break;
      case "HIDDEN":
        await locator.waitFor({ state: "hidden", timeout });
        matched = true;
        actual = "hidden";
        break;
      case "ENABLED":
        await locator.waitFor({ state: "visible", timeout });
        matched = await locator.isEnabled();
        actual = matched ? "enabled" : "disabled";
        break;
      case "DISABLED":
        await locator.waitFor({ state: "visible", timeout });
        matched = await locator.isDisabled();
        actual = matched ? "disabled" : "enabled";
        break;
      case "ATTRIBUTE_EQUALS": {
        const result = await observeAttribute(locator, observation, timeout);
        matched = result.matched;
        actual = result.actual;
        break;
      }
    }
  } catch (error) {
    actual = error instanceof Error ? error.message : String(error);
  }

  const detail = matched
    ? `Configured element state ${observation.state} was observed.`
    : `Configured element state ${observation.state} was not observed.`;

  return {
    matched,
    detail,
    ...(actual === undefined ? {} : { actual }),
    evidence: createEvidenceEntry("ELEMENT_STATE", detail, {
      state: observation.state,
      matched,
      ...(actual === undefined ? {} : { actual }),
    }),
  };
};
