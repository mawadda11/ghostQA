import { createHash } from "node:crypto";

import type { EvidenceEntry, LocatorSpec } from "@ghostqa/shared";
import type { Page } from "playwright";

import { resolveLocator } from "../baseline/locators.js";
import { createEvidenceEntry } from "./evidence.js";

export interface CriticalControlSnapshot {
  attached: boolean;
  visible: boolean;
  enabled: boolean;
  ariaBusy: boolean;
  textFingerprint?: string;
}

export interface CriticalControlProbe {
  primary: LocatorSpec;
  fallback?: LocatorSpec;
}

export interface AutomaticStatusObservation {
  visibleCount: number;
  roles: readonly string[];
  textFingerprints: readonly string[];
}

const hashText = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 12);

export const prepareCriticalControlProbe = async (
  page: Page,
  locator: LocatorSpec,
): Promise<CriticalControlProbe> => {
  try {
    const fallback = await resolveLocator(page, locator).evaluate((element) => {
      const testId = element.getAttribute("data-testid")?.trim();
      if (testId !== undefined && testId.length > 0) {
        return { kind: "TEST_ID" as const, value: testId };
      }
      const id = element.getAttribute("id")?.trim();
      return id === undefined || id.length === 0
        ? undefined
        : { kind: "CSS" as const, selector: `#${CSS.escape(id)}` };
    });
    return {
      primary: locator,
      ...(fallback === undefined ? {} : { fallback }),
    };
  } catch {
    return { primary: locator };
  }
};

export const snapshotCriticalControl = async (
  page: Page,
  probe: CriticalControlProbe,
): Promise<CriticalControlSnapshot> => {
  for (const locator of [probe.primary, probe.fallback]) {
    if (locator === undefined) continue;
    const resolved = resolveLocator(page, locator);
    try {
      await resolved.waitFor({ state: "attached", timeout: 350 });
      const state = await resolved.evaluate((element) => {
        const htmlElement = element as HTMLElement;
        const style = window.getComputedStyle(htmlElement);
        const visible =
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          htmlElement.getClientRects().length > 0;
        const disabledProperty =
          "disabled" in htmlElement &&
          Boolean((htmlElement as HTMLButtonElement).disabled);
        return {
          visible,
          enabled:
            !disabledProperty && htmlElement.getAttribute("aria-disabled") !== "true",
          ariaBusy: htmlElement.getAttribute("aria-busy") === "true",
          text: (htmlElement.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 512),
        };
      });
      return {
        attached: true,
        visible: state.visible,
        enabled: state.enabled,
        ariaBusy: state.ariaBusy,
        ...(state.text.length === 0 ? {} : { textFingerprint: hashText(state.text) }),
      };
    } catch {
      // Try the runtime-only stable fallback when the accessible name changed.
    }
  }
  return {
    attached: false,
    visible: false,
    enabled: false,
    ariaBusy: false,
  };
};

export const isStablePendingControl = (
  state: CriticalControlSnapshot,
): boolean => state.attached && state.visible && (!state.enabled || state.ariaBusy);

export const controlStateEvidence = (
  message: string,
  before: CriticalControlSnapshot,
  during: CriticalControlSnapshot,
  after?: CriticalControlSnapshot,
  extra: Readonly<Record<string, boolean | number | string>> = {},
): EvidenceEntry =>
  createEvidenceEntry("ELEMENT_STATE", message, {
    beforeVisible: before.visible,
    beforeEnabled: before.enabled,
    beforeAriaBusy: before.ariaBusy,
    duringAttached: during.attached,
    duringVisible: during.visible,
    duringEnabled: during.enabled,
    duringAriaBusy: during.ariaBusy,
    textChanged:
      before.textFingerprint !== undefined &&
      during.textFingerprint !== undefined &&
      before.textFingerprint !== during.textFingerprint,
    ...(after === undefined
      ? {}
      : {
          afterAttached: after.attached,
          afterVisible: after.visible,
          afterEnabled: after.enabled,
          afterAriaBusy: after.ariaBusy,
        }),
    ...extra,
  });

export const observeAutomaticStatus = async (
  page: Page,
): Promise<AutomaticStatusObservation> => {
  const candidates = page.locator('[role="alert"], [role="status"], [aria-live]');
  const count = Math.min(await candidates.count(), 20);
  const visible = [] as Array<{ role: string; text: string }>;
  for (let index = 0; index < count; index += 1) {
    const candidate = candidates.nth(index);
    try {
      const observation = await candidate.evaluate((element) => {
        const htmlElement = element as HTMLElement;
        const style = window.getComputedStyle(htmlElement);
        return {
          visible:
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            htmlElement.getClientRects().length > 0,
          role:
            htmlElement.getAttribute("role") ??
            (htmlElement.hasAttribute("aria-live") ? "aria-live" : "unknown"),
          text: (htmlElement.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 512),
        };
      });
      if (observation.visible) visible.push(observation);
    } catch {
      // A status node can disappear during a normal render; absence is conservative.
    }
  }
  return {
    visibleCount: visible.length,
    roles: [...new Set(visible.map(({ role }) => role))],
    textFingerprints: visible
      .filter(({ text }) => text.length > 0)
      .map(({ text }) => hashText(text)),
  };
};

export const tryCriticalControlActivation = async (
  page: Page,
  probe: CriticalControlProbe,
): Promise<boolean> => {
  for (const locator of [probe.primary, probe.fallback]) {
    if (locator === undefined) continue;
    try {
      await resolveLocator(page, locator).click({ timeout: 750 });
      return true;
    } catch {
      // Try the fallback if activation changed the accessible name.
    }
  }
  return false;
};

export const safePathname = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};
