import type {
  ConsoleObservation,
  NetworkObservation,
} from "@ghostqa/shared";
import type { Page, Request } from "playwright";

const nowIso = (): string => new Date().toISOString();

export class BrowserEvidenceCollector {
  readonly network: NetworkObservation[] = [];
  readonly console: ConsoleObservation[] = [];
  readonly #requestStartTimes = new Map<Request, string>();

  attach(page: Page): void {
    page.on("request", (request) => {
      this.#requestStartTimes.set(request, nowIso());
    });

    page.on("response", (response) => {
      const request = response.request();
      this.network.push({
        method: request.method(),
        url: request.url(),
        status: response.status(),
        startedAt: this.#requestStartTimes.get(request) ?? nowIso(),
        completedAt: nowIso(),
      });
      this.#requestStartTimes.delete(request);
    });

    page.on("requestfailed", (request) => {
      this.network.push({
        method: request.method(),
        url: request.url(),
        failureText: request.failure()?.errorText ?? "Request failed",
        startedAt: this.#requestStartTimes.get(request) ?? nowIso(),
        completedAt: nowIso(),
      });
      this.#requestStartTimes.delete(request);
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        this.console.push({
          source: "CONSOLE",
          level: "error",
          text: message.text(),
          timestamp: nowIso(),
        });
      }
    });

    page.on("pageerror", (error) => {
      this.console.push({
        source: "PAGE_ERROR",
        level: "error",
        text: error.message,
        timestamp: nowIso(),
      });
    });
  }
}
