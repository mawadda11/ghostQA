import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";

import type { NormalizedFlow } from "@ghostqa/shared";
import {
  PlaywrightBaselineEngine,
  PlaywrightCaptureEngine,
} from "@ghostqa/test-engine";
import { test } from "vitest";

const page = `<!doctype html>
<html><body>
  <main>
    <h1>Submission workspace</h1>
    <label>Email <input name="email" type="email"></label>
    <label>Password <input name="password" type="password"></label>
    <button type="button">Submit application</button>
  </main>
  <script>
    document.querySelector('button').addEventListener('click', async () => {
      const response = await fetch('/api/submissions', { method: 'POST' });
      if (response.ok) {
        history.pushState({}, '', '/complete');
        document.querySelector('main').innerHTML = '<h1>Application complete</h1><p role="status">Saved successfully</p>';
        document.body.dataset.done = 'true';
      }
    });
  </script>
</body></html>`;

test(
  "real Chromium capture normalizes and replays through the existing baseline engine",
  async () => {
    const server = createServer((request, response) => {
      if (request.method === "POST" && request.url === "/api/submissions") {
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end('{"id":"submission-1"}');
        return;
      }
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(page);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/`;
    const artifactRoot = await mkdtemp(
      path.join(tmpdir(), "ghostqa-capture-integration-"),
    );
    try {
      const captureEngine = new PlaywrightCaptureEngine({
        headless: true,
        afterPageOpened: async (browserPage) => {
          await browserPage.getByLabel("Email").fill("developer@example.test");
          await browserPage.getByLabel("Password").fill("local-fixture-secret");
          await browserPage.getByRole("button", { name: "Submit application" }).click();
          await browserPage.waitForURL("**/complete");
          await browserPage.locator("body[data-done=true]").waitFor();
        },
      });
      const handle = await captureEngine.start({
        target: { baseUrl, allowedHosts: ["127.0.0.1"] },
        suggestedFlowId: "captured-integration",
        suggestedFlowName: "Captured integration baseline",
        onUnexpectedClose: (error) => {
          throw error;
        },
      });
      const draft = await handle.stop();
      const diagnostics = handle.getDiagnostics?.();
      assert.ok(diagnostics);
      assert.equal(diagnostics.events.length, 5);
      assert.equal(
        diagnostics.events.find((event) => event.sensitive === true)
          ?.valueLength,
        undefined,
      );
      assert.doesNotMatch(
        JSON.stringify(diagnostics),
        /local-fixture-secret/,
      );
      assert.deepEqual(
        draft.steps.map((step) => step.action),
        ["NAVIGATE", "FILL", "FILL", "CLICK", "WAIT_FOR_URL"],
      );
      const password = draft.steps.find(
        (step) => step.action === "FILL" && step.sensitive === true,
      );
      assert.ok(password);
      const candidate = draft.criticalActionCandidates[0];
      assert.ok(
        candidate,
        JSON.stringify({
          diagnosticEvents: diagnostics.events,
          diagnosticNetwork: diagnostics.network,
          normalizedNetwork: draft.network,
          normalizedSteps: draft.steps.map(({ id, action }) => ({ id, action })),
        }),
      );
      assert.deepEqual(candidate.request, {
        method: "POST",
        pathname: "/api/submissions",
      });
      assert.ok(draft.successTextCandidates.includes("Application complete"));

      const flow: NormalizedFlow = {
        id: draft.suggestedId,
        name: draft.suggestedName,
        steps: draft.steps,
        criticalAction: {
          stepId: candidate.stepId,
          label: candidate.label,
          request: candidate.request,
        },
        successAssertion: {
          kind: "TEXT_VISIBLE",
          text: "Application complete",
          exact: true,
        },
        assertions: [
          {
            id: "workspace-visible",
            afterStepId: password.id,
            assertion: {
              kind: "TEXT_VISIBLE",
              text: "Submission workspace",
              exact: true,
            },
          },
        ],
      };
      const replay = await new PlaywrightBaselineEngine().execute({
        kind: "BASELINE",
        runId: "capture-integration-replay",
        target: { baseUrl, allowedHosts: ["127.0.0.1"] },
        flow,
        artifactDirectory: artifactRoot,
      });
      assert.equal(
        replay.status,
        "PASS",
        JSON.stringify({
          summary: replay.summary,
          steps: replay.executedSteps,
          assertions: replay.assertions,
          error: replay.executionError,
        }),
      );
      assert.deepEqual(
        replay.assertions?.map(({ id, status }) => ({ id, status })),
        [
          { id: "workspace-visible", status: "PASSED" },
          { id: "final-success-assertion", status: "PASSED" },
        ],
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
      await rm(artifactRoot, { recursive: true, force: true });
    }
  },
  60_000,
);

test(
  "real Chromium replays a captured non-mutation flow without a critical action",
  async () => {
    const readOnlyPage = `<!doctype html><html><body><main>
      <h1>Directory</h1>
      <label>Search <input name="search" type="search"></label>
      <a href="/result">Open result</a>
    </main></body></html>`;
    const resultPage = `<!doctype html><html><body><main><h1>Result details</h1><a href="/">Back to directory</a></main></body></html>`;
    const server = createServer((request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(request.url === "/result" ? resultPage : readOnlyPage);
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/`;
    const artifactRoot = await mkdtemp(
      path.join(tmpdir(), "ghostqa-read-only-integration-"),
    );
    try {
      const handle = await new PlaywrightCaptureEngine({
        headless: true,
        afterPageOpened: async (browserPage) => {
          await browserPage.getByLabel("Search").fill("sample");
          await browserPage.getByRole("link", { name: "Open result" }).click();
          await browserPage.waitForURL("**/result");
        },
      }).start({
        target: { baseUrl, allowedHosts: ["127.0.0.1"] },
        suggestedFlowId: "read-only-capture",
        suggestedFlowName: "Read-only capture",
        onUnexpectedClose: (error) => {
          throw error;
        },
      });
      const draft = await handle.stop();
      assert.equal(draft.criticalActionCandidates.length, 0);
      const finalStep = draft.steps.at(-1);
      assert.ok(finalStep);
      const flow: NormalizedFlow = {
        id: draft.suggestedId,
        name: draft.suggestedName,
        steps: draft.steps,
        assertions: [
          {
            id: "result-visible",
            afterStepId: finalStep.id,
            assertion: {
              kind: "TEXT_VISIBLE",
              text: "Result details",
              exact: true,
            },
          },
        ],
      };
      const replay = await new PlaywrightBaselineEngine().execute({
        kind: "BASELINE",
        runId: "read-only-replay",
        target: { baseUrl, allowedHosts: ["127.0.0.1"] },
        flow,
        artifactDirectory: artifactRoot,
      });
      assert.equal(
        replay.status,
        "PASS",
        JSON.stringify({
          draftSteps: draft.steps,
          summary: replay.summary,
          steps: replay.executedSteps,
          assertions: replay.assertions,
          error: replay.executionError,
        }),
      );
      assert.equal(replay.assertions?.[0]?.status, "PASSED");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
      await rm(artifactRoot, { recursive: true, force: true });
    }
  },
  60_000,
);

test(
  "real Chromium capture blocks navigation to a non-allowlisted hostname",
  async () => {
    let externalUrl = "";
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end(
        `<!doctype html><html><body><a href="${externalUrl}">Leave target</a></body></html>`,
      );
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/`;
    externalUrl = `http://localhost:${address.port}/outside`;
    let reportUnexpected: (error: Error) => void = () => undefined;
    const unexpected = new Promise<Error>((resolve) => {
      reportUnexpected = resolve;
    });
    try {
      const captureEngine = new PlaywrightCaptureEngine({
        headless: true,
        afterPageOpened: async (browserPage) => {
          await browserPage.evaluate((url) => {
            window.location.href = url;
          }, externalUrl);
        },
      });
      const handle = await captureEngine.start({
        target: { baseUrl, allowedHosts: ["127.0.0.1"] },
        suggestedFlowId: "blocked-navigation",
        suggestedFlowName: "Blocked navigation",
        onUnexpectedClose: reportUnexpected,
      });
      const error = await unexpected;
      assert.match(error.message, /non-allowlisted host/);
      await assert.rejects(handle.stop(), /no longer active/);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    }
  },
  60_000,
);
