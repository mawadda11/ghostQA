import type {
  AriaRole,
  CaptureDiagnosticEvent,
  CaptureDiagnosticLocatorCandidates,
  CaptureDiagnostics,
  CaptureDiagnosticStage,
  CapturedFlowDraft,
} from "@ghostqa/shared";
import { chromium } from "playwright";
import type {
  Browser,
  BrowserContext,
  Page,
  Request,
} from "playwright";

import { normalizeCapturedInteractions } from "./normalization.js";
import { CaptureNormalizationError } from "./locators.js";
import {
  selectUsefulTextCandidates,
} from "./text-candidates.js";
import type { VisibleTextCandidateObservation } from "./text-candidates.js";
import type {
  CaptureEngine,
  CaptureHandle,
  CaptureStartRequest,
  RawCaptureEvent,
  RawCaptureNetworkObservation,
  RawLocatorCandidates,
} from "./types.js";

const CAPTURE_BINDING = "__ghostqaCaptureEvent";
const CAPTURE_FLUSH = "__ghostqaCaptureFlush";
const SUPPORTED_ROLES = new Set<AriaRole>([
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "heading",
  "link",
  "listitem",
  "navigation",
  "radio",
  "searchbox",
  "status",
  "textbox",
]);

export class CaptureBrowserError extends Error {
  constructor(
    message: string,
    readonly diagnostics?: CaptureDiagnostics,
  ) {
    super(message);
    this.name = "CaptureBrowserError";
  }
}

const normalizeHostname = (value: string): string =>
  value.trim().toLowerCase().replace(/\.$/, "");

const assertAllowedCaptureUrl = (
  rawUrl: string,
  allowedHosts: readonly string[],
): URL => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CaptureBrowserError("The capture target URL is invalid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CaptureBrowserError("Capture targets must use HTTP or HTTPS.");
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new CaptureBrowserError(
      "Capture targets must not contain embedded credentials.",
    );
  }
  const hosts = new Set(allowedHosts.map(normalizeHostname));
  if (!hosts.has(normalizeHostname(url.hostname))) {
    throw new CaptureBrowserError(
      `Capture target host "${url.hostname}" is not allowlisted.`,
    );
  }
  return url;
};

const diagnosticText = (value: string): string => value.slice(0, 160);

const diagnosticPathname = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return "<invalid-url>";
  }
};

const diagnosticLocator = (
  candidates: RawLocatorCandidates,
): CaptureDiagnosticLocatorCandidates => ({
  ...(candidates.role === undefined
    ? {}
    : {
        role: {
          ...candidates.role,
          name: diagnosticText(candidates.role.name),
        },
      }),
  ...(candidates.label === undefined
    ? {}
    : {
        label: {
          ...candidates.label,
          text: diagnosticText(candidates.label.text),
        },
      }),
  ...(candidates.testId === undefined
    ? {}
    : {
        testId: {
          ...candidates.testId,
          value: diagnosticText(candidates.testId.value),
        },
      }),
  ...(candidates.text === undefined
    ? {}
    : {
        text: {
          ...candidates.text,
          text: diagnosticText(candidates.text.text),
        },
      }),
  ...(candidates.css === undefined
    ? {}
    : {
        css: {
          ...candidates.css,
          selector: diagnosticText(candidates.css.selector),
        },
      }),
});

const diagnosticEvent = (event: RawCaptureEvent): CaptureDiagnosticEvent => ({
  order: event.order,
  kind: event.kind,
  timestamp: new Date(event.timestampMs).toISOString(),
  pathname: diagnosticPathname(event.pageUrl),
  ...(event.kind === "NAVIGATION"
    ? {}
    : { locator: diagnosticLocator(event.locator) }),
  ...(event.kind === "FILL" && event.sensitive ? { sensitive: true } : {}),
  ...(event.kind === "FILL" && !event.sensitive
    ? { valueLength: event.value.length }
    : {}),
  ...(event.kind === "SELECT_OPTION"
    ? { valueLength: event.value.length }
    : {}),
});

const captureDiagnostics = (
  stage: CaptureDiagnosticStage,
  errorMessage: string,
  events: readonly RawCaptureEvent[],
  network: readonly RawCaptureNetworkObservation[],
  finalUrl?: string,
): CaptureDiagnostics => ({
  stage,
  errorMessage,
  events: events.map(diagnosticEvent),
  network: network.map((observation) => ({
    method: observation.method,
    pathname: observation.pathname,
    ...(observation.status === undefined
      ? {}
      : { status: observation.status }),
    timestamp: new Date(observation.timestampMs).toISOString(),
  })),
  ...(finalUrl === undefined
    ? {}
    : { finalPathname: diagnosticPathname(finalUrl) }),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readLocatorCandidates = (
  value: unknown,
): RawLocatorCandidates | undefined => {
  if (!isRecord(value)) return undefined;
  const candidates: RawLocatorCandidates = {};
  if (isRecord(value["role"])) {
    const role = value["role"]["role"];
    const name = value["role"]["name"];
    const unique = value["role"]["unique"];
    if (
      typeof role === "string" &&
      SUPPORTED_ROLES.has(role as AriaRole) &&
      typeof name === "string" &&
      typeof unique === "boolean"
    ) {
      candidates.role = { role: role as AriaRole, name, unique };
    }
  }
  for (const [source, property] of [
    ["label", "text"],
    ["testId", "value"],
    ["text", "text"],
    ["css", "selector"],
  ] as const) {
    const candidate = value[source];
    if (
      isRecord(candidate) &&
      typeof candidate[property] === "string" &&
      typeof candidate["unique"] === "boolean"
    ) {
      const normalized = {
        [property]: candidate[property],
        unique: candidate["unique"],
      };
      if (source === "label") candidates.label = normalized as { text: string; unique: boolean };
      if (source === "testId") candidates.testId = normalized as { value: string; unique: boolean };
      if (source === "text") candidates.text = normalized as { text: string; unique: boolean };
      if (source === "css") candidates.css = normalized as { selector: string; unique: boolean };
    }
  }
  return candidates;
};

const readBrowserEvent = (
  value: unknown,
  order: number,
): RawCaptureEvent | undefined => {
  if (!isRecord(value)) return undefined;
  const kind = value["kind"];
  const timestampMs = value["timestampMs"];
  const pageUrl = value["pageUrl"];
  if (
    (kind !== "CLICK" && kind !== "FILL" && kind !== "SELECT_OPTION") ||
    typeof timestampMs !== "number" ||
    !Number.isFinite(timestampMs) ||
    typeof pageUrl !== "string"
  ) {
    return undefined;
  }
  const locator = readLocatorCandidates(value["locator"]);
  if (locator === undefined) return undefined;
  if (kind === "CLICK") {
    return { kind, order, timestampMs, pageUrl, locator };
  }
  const eventValue = value["value"];
  if (typeof eventValue !== "string") return undefined;
  if (kind === "FILL") {
    return {
      kind,
      order,
      timestampMs,
      pageUrl,
      locator,
      value: eventValue,
      sensitive: value["sensitive"] === true,
    };
  }
  return { kind, order, timestampMs, pageUrl, locator, value: eventValue };
};

const installCaptureListeners = (): void => {
  const captureWindow = window as typeof window & {
    __ghostqaCaptureEvent?: (event: unknown) => Promise<void>;
    __ghostqaCaptureFlush?: () => Promise<void>;
  };
  if (captureWindow.__ghostqaCaptureFlush !== undefined) return;
  const supportedRoles = new Set<AriaRole>([
    "button",
    "checkbox",
    "combobox",
    "dialog",
    "heading",
    "link",
    "listitem",
    "navigation",
    "radio",
    "searchbox",
    "status",
    "textbox",
  ]);

  const normalizeText = (value: string | null | undefined): string =>
    (value ?? "").replace(/\s+/g, " ").trim();
  const isVisible = (element: Element): boolean => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      bounds.width > 0 &&
      bounds.height > 0
    );
  };
  const labelFor = (element: Element): string => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      const direct = element.labels?.[0];
      if (direct !== undefined) return normalizeText(direct.textContent);
    }
    const wrapped = element.closest("label");
    return normalizeText(wrapped?.textContent);
  };
  const roleFor = (element: Element): AriaRole | undefined => {
    const explicit = element.getAttribute("role");
    if (explicit !== null && supportedRoles.has(explicit as AriaRole)) {
      return explicit as AriaRole;
    }
    const tag = element.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a" && element.hasAttribute("href")) return "link";
    if (tag === "textarea") return "textbox";
    if (tag === "select") return "combobox";
    if (tag === "input") {
      const type = (element.getAttribute("type") ?? "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "search") return "searchbox";
      if (["text", "email", "tel", "url"].includes(type)) return "textbox";
      if (["button", "submit", "reset"].includes(type)) return "button";
    }
    return undefined;
  };
  const accessibleName = (element: Element): string => {
    const ariaLabel = normalizeText(element.getAttribute("aria-label"));
    if (ariaLabel.length > 0) return ariaLabel;
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy !== null) {
      const text = normalizeText(
        labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" "),
      );
      if (text.length > 0) return text;
    }
    const label = labelFor(element);
    if (label.length > 0) return label;
    if (element instanceof HTMLInputElement) {
      const value = normalizeText(element.value);
      if (["button", "submit", "reset"].includes(element.type) && value.length > 0) return value;
    }
    return normalizeText(
      (element as HTMLElement).innerText ||
        element.getAttribute("alt") ||
        element.getAttribute("title") ||
        element.getAttribute("placeholder"),
    );
  };
  const roleCount = (role: AriaRole, name: string): number =>
    [...document.querySelectorAll("*")].filter(
      (element) =>
        isVisible(element) &&
        roleFor(element) === role &&
        accessibleName(element) === name,
    ).length;
  const labelCount = (label: string): number =>
    [...document.querySelectorAll("input,textarea,select")].filter(
      (element) => isVisible(element) && labelFor(element) === label,
    ).length;
  const stableCss = (element: Element): string | undefined => {
    const id = element.getAttribute("id");
    if (id !== null && id.length > 0 && !/^\d+$/.test(id)) {
      const selector = `#${CSS.escape(id)}`;
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    const name = element.getAttribute("name");
    if (name !== null && name.length > 0) {
      const selector = `${element.tagName.toLowerCase()}[name=${JSON.stringify(name)}]`;
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    return undefined;
  };
  const locatorFor = (element: Element): RawLocatorCandidates => {
    const role = roleFor(element);
    const name = accessibleName(element);
    const label = labelFor(element);
    const testId = normalizeText(element.getAttribute("data-testid"));
    const text = normalizeText((element as HTMLElement).innerText);
    const css = stableCss(element);
    return {
      ...(role === undefined || name.length === 0
        ? {}
        : { role: { role, name, unique: roleCount(role, name) === 1 } }),
      ...(label.length === 0
        ? {}
        : { label: { text: label, unique: labelCount(label) === 1 } }),
      ...(testId.length === 0
        ? {}
        : {
            testId: {
              value: testId,
              unique:
                document.querySelectorAll(
                  `[data-testid=${JSON.stringify(testId)}]`,
                ).length === 1,
            },
          }),
      ...(text.length === 0 || text.length > 200
        ? {}
        : {
            text: {
              text,
              unique:
                [...document.querySelectorAll("body *")].filter(
                  (candidate) =>
                    isVisible(candidate) &&
                    normalizeText((candidate as HTMLElement).innerText) === text,
                ).length === 1,
            },
          }),
      ...(css === undefined ? {} : { css: { selector: css, unique: true } }),
    };
  };
  const pendingEvents = new Set<Promise<void>>();
  const emit = (event: unknown): void => {
    const emitted = captureWindow.__ghostqaCaptureEvent?.(event);
    if (emitted === undefined) return;
    const tracked = emitted.catch(() => undefined);
    pendingEvents.add(tracked);
    void tracked.finally(() => pendingEvents.delete(tracked));
  };
  const dirty = new Set<HTMLInputElement | HTMLTextAreaElement>();
  const lastEmittedValue = new WeakMap<Element, string>();
  const emitFill = (element: HTMLInputElement | HTMLTextAreaElement): void => {
    if (lastEmittedValue.get(element) === element.value) return;
    lastEmittedValue.set(element, element.value);
    emit({
      kind: "FILL",
      timestampMs: Date.now(),
      pageUrl: location.href,
      locator: locatorFor(element),
      value: element.value,
      sensitive:
        element instanceof HTMLInputElement &&
        element.type.toLowerCase() === "password",
    });
  };

  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest(
        'button,a[href],input[type="button"],input[type="submit"],input[type="reset"],input[type="checkbox"],input[type="radio"],[role]',
      );
      if (target === null) return;
      emit({
        kind: "CLICK",
        timestampMs: Date.now(),
        pageUrl: location.href,
        locator: locatorFor(target),
      });
    },
    true,
  );
  document.addEventListener(
    "input",
    (event) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        const type =
          event.target instanceof HTMLInputElement
            ? event.target.type.toLowerCase()
            : "textarea";
        if (!["checkbox", "radio", "button", "submit", "reset", "file"].includes(type)) {
          dirty.add(event.target);
        }
      }
    },
    true,
  );
  document.addEventListener(
    "change",
    (event) => {
      if (event.target instanceof HTMLSelectElement) {
        emit({
          kind: "SELECT_OPTION",
          timestampMs: Date.now(),
          pageUrl: location.href,
          locator: locatorFor(event.target),
          value: event.target.value,
        });
      } else if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        if (dirty.has(event.target)) emitFill(event.target);
        dirty.delete(event.target);
      }
    },
    true,
  );
  document.addEventListener(
    "focusout",
    (event) => {
      if (
        (event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement) &&
        dirty.has(event.target)
      ) {
        emitFill(event.target);
        dirty.delete(event.target);
      }
    },
    true,
  );
  captureWindow.__ghostqaCaptureFlush = async () => {
    for (const element of dirty) emitFill(element);
    dirty.clear();
    await Promise.all([...pendingEvents]);
  };
};

const visibleTextCandidateObservations = (): VisibleTextCandidateObservation[] => {
  const visible = (element: Element): boolean => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      bounds.width > 0 &&
      bounds.height > 0
    );
  };
  return [
    ...document.querySelectorAll(
      "[role=alert],[role=status],[aria-live]:not([aria-live=off]),h1,h2,h3,h4,main p,[data-status]",
    ),
  ].map((element) => ({
    text: element.textContent ?? "",
    kind:
      element.getAttribute("role") === "alert"
        ? "ALERT"
        : element.getAttribute("role") === "status" ||
            element.hasAttribute("data-status")
          ? "STATUS"
          : element.hasAttribute("aria-live")
            ? "LIVE_REGION"
            : /^H[1-4]$/.test(element.tagName)
              ? "HEADING"
              : "PROMINENT_TEXT",
    visible: visible(element),
    insideNavigation: element.closest("nav,header,footer,[role=navigation]") !== null,
    interactive: element.closest("button,a,label,[role=button],[role=link]") !== null,
  }));
};

export interface PlaywrightCaptureEngineOptions {
  headless?: boolean;
  afterPageOpened?: (page: Page) => Promise<void>;
}

export class PlaywrightCaptureEngine implements CaptureEngine {
  constructor(private readonly options: PlaywrightCaptureEngineOptions = {}) {}

  async start(request: CaptureStartRequest): Promise<CaptureHandle> {
    const targetUrl = assertAllowedCaptureUrl(
      request.target.baseUrl,
      request.target.allowedHosts,
    );
    const events: RawCaptureEvent[] = [];
    const network: RawCaptureNetworkObservation[] = [];
    const pendingRequests = new Map<Request, RawCaptureNetworkObservation>();
    let order = 0;
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let page: Page | undefined;
    let active = true;
    let finalizing = false;
    let unexpectedReported = false;
    let lastDiagnostics: CaptureDiagnostics | undefined;

    const cleanup = async (): Promise<void> => {
      try {
        await context?.close();
      } catch {
        // The browser may already have been closed manually.
      }
      try {
        await browser?.close();
      } catch {
        // The browser may already have crashed or disconnected.
      }
    };
    const reportUnexpected = (message: string): void => {
      if (finalizing || unexpectedReported) return;
      unexpectedReported = true;
      active = false;
      finalizing = true;
      lastDiagnostics = captureDiagnostics(
        "CAPTURING",
        message,
        events,
        network,
        page?.url(),
      );
      void cleanup().finally(() =>
        request.onUnexpectedClose(
          new CaptureBrowserError(message, lastDiagnostics),
        ),
      );
    };

    try {
      browser = await chromium.launch({ headless: this.options.headless ?? false });
      browser.on("disconnected", () =>
        reportUnexpected("The capture browser closed before capture was stopped."),
      );
      context = await browser.newContext();
      await context.exposeBinding(CAPTURE_BINDING, (_source, payload) => {
        const event = readBrowserEvent(payload, order++);
        if (event !== undefined) events.push(event);
      });
      await context.addInitScript(installCaptureListeners);
      await context.route("**/*", async (route) => {
        const captureRequest = route.request();
        if (captureRequest.isNavigationRequest()) {
          try {
            assertAllowedCaptureUrl(
              captureRequest.url(),
              request.target.allowedHosts,
            );
          } catch {
            await route.abort("blockedbyclient");
            reportUnexpected(
              "Capture stopped because the target navigated to a non-allowlisted host.",
            );
            return;
          }
        }
        await route.continue();
      });
      page = await context.newPage();
      context.on("page", (openedPage) => {
        if (openedPage !== page) {
          reportUnexpected(
            "Capture stopped because the target opened an additional browser page.",
          );
        }
      });
      page.on("close", () =>
        reportUnexpected("The capture page closed before capture was stopped."),
      );
      page.on("framenavigated", (frame) => {
        if (frame !== page?.mainFrame() || !/^https?:/.test(frame.url())) return;
        try {
          assertAllowedCaptureUrl(frame.url(), request.target.allowedHosts);
          events.push({
            kind: "NAVIGATION",
            order: order++,
            timestampMs: Date.now(),
            pageUrl: frame.url(),
            url: frame.url(),
          });
        } catch {
          reportUnexpected(
            "Capture stopped because the target navigated to a non-allowlisted host.",
          );
        }
      });
      page.on("request", (observedRequest) => {
        let url: URL;
        try {
          url = new URL(observedRequest.url());
        } catch {
          return;
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") return;
        const observation: RawCaptureNetworkObservation = {
          method: observedRequest.method().toUpperCase(),
          pathname: url.pathname,
          timestampMs: Date.now(),
        };
        network.push(observation);
        pendingRequests.set(observedRequest, observation);
      });
      page.on("response", (response) => {
        const observation = pendingRequests.get(response.request());
        if (observation !== undefined) observation.status = response.status();
      });
      await page.goto(targetUrl.href, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      await this.options.afterPageOpened?.(page);
    } catch (error) {
      active = false;
      finalizing = true;
      await cleanup();
      const message =
        error instanceof Error ? error.message : "Unknown browser launch error.";
      throw new CaptureBrowserError(
        `GhostQA could not start baseline capture: ${message}`,
        lastDiagnostics,
      );
    }

    const requireActive = (): Page => {
      if (!active || finalizing || page === undefined) {
        throw new CaptureBrowserError("This capture session is no longer active.");
      }
      return page;
    };

    const stopWithError = async (
      stage: CaptureDiagnosticStage,
      message: string,
      finalUrl?: string,
    ): Promise<never> => {
      active = false;
      lastDiagnostics = captureDiagnostics(
        stage,
        message,
        events,
        network,
        finalUrl,
      );
      await cleanup();
      throw new CaptureBrowserError(message, lastDiagnostics);
    };

    const afterNavigationRetry = async <Value>(
      operation: () => Promise<Value>,
    ): Promise<Value> => {
      try {
        return await operation();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!/execution context was destroyed|cannot find context/i.test(message)) {
          throw error;
        }
        await page?.waitForLoadState("domcontentloaded", { timeout: 5_000 });
        return operation();
      }
    };

    return {
      stop: async (): Promise<CapturedFlowDraft> => {
        const activePage = requireActive();
        finalizing = true;
        try {
          await afterNavigationRetry(() =>
            activePage.evaluate(async (flushName) => {
              const captureWindow = window as typeof window & {
                [key: string]: (() => Promise<void>) | undefined;
              };
              await captureWindow[flushName]?.();
            }, CAPTURE_FLUSH),
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : "Unknown page error";
          return stopWithError(
            "FLUSHING_EVENTS",
            `Capture could not finish collecting browser events: ${detail}`,
            activePage.url(),
          );
        }

        let finalUrl: string;
        let textCandidates: string[];
        try {
          [finalUrl, textCandidates] = await Promise.all([
            Promise.resolve(activePage.url()),
            afterNavigationRetry(() =>
              activePage
                .evaluate(visibleTextCandidateObservations)
                .then((observations) => selectUsefulTextCandidates(observations)),
            ),
          ]);
        } catch (error) {
          const detail = error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : "Unknown page error";
          return stopWithError(
            "READING_FINAL_PAGE",
            `Capture could not inspect the final page: ${detail}`,
            activePage.url(),
          );
        }

        let draft: CapturedFlowDraft;
        lastDiagnostics = captureDiagnostics(
          "NORMALIZING",
          "Capture events collected successfully.",
          events,
          network,
          finalUrl,
        );
        try {
          draft = normalizeCapturedInteractions({
            baseUrl: targetUrl.href,
            suggestedFlowId: request.suggestedFlowId,
            suggestedFlowName: request.suggestedFlowName,
            events,
            network,
            finalUrl,
            successTextCandidates: textCandidates,
          });
        } catch (error) {
          const message =
            error instanceof CaptureNormalizationError
              ? error.message
              : "Captured browser events could not be normalized safely.";
          return stopWithError("NORMALIZING", message, finalUrl);
        }

        active = false;
        await cleanup();
        return draft;
      },
      cancel: async (): Promise<void> => {
        requireActive();
        finalizing = true;
        active = false;
        await cleanup();
      },
      getDiagnostics: () => lastDiagnostics,
    };
  }
}
