import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import type { ProjectSummary, TestRunDetail } from "@ghostqa/shared";
import { chromium } from "playwright";

import { seedGhostShop } from "../persistence/seed-ghostshop.js";
import { repositoryRootFromModule } from "../support/repository-root.js";

const pageUrl = (baseUrl: string, pathname: string): string =>
  new URL(pathname, `${baseUrl.replace(/\/$/, "")}/`).href;

test(
  "the real GhostShop workflow is operable and persistent through the dashboard",
  { timeout: 240_000 },
  async () => {
    const dashboardUrl =
      process.env["GHOSTQA_DASHBOARD_URL"] ?? "http://127.0.0.1:5173";
    const serverUrl =
      process.env["GHOSTQA_SERVER_URL"] ?? "http://127.0.0.1:4000";
    const targetUrl =
      process.env["GHOSTSHOP_URL"] ?? "http://127.0.0.1:4173";
    const seeded = await seedGhostShop(serverUrl, targetUrl);
    const reset = await fetch(pageUrl(targetUrl, "/api/test/reset"), {
      method: "POST",
    });
    assert.equal(reset.status, 200);

    const proofRoot = path.join(
      repositoryRootFromModule(),
      "artifacts",
      "dashboard-proof",
    );
    await mkdir(proofRoot, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    try {
      await page.goto(pageUrl(dashboardUrl, "/"));
      await page.getByRole("heading", { name: "Overview" }).waitFor();
      await page.screenshot({ path: path.join(proofRoot, "01-overview.png"), fullPage: true });

      await page
        .getByRole("link", { name: "Projects", exact: true })
        .click();
      await page.getByRole("heading", { name: "Projects" }).waitFor();

      const temporaryProjectName = `Dashboard E2E ${Date.now()}`;
      await page.getByRole("button", { name: "Create project" }).click();
      const projectDialog = page.getByRole("dialog");
      await projectDialog.getByLabel("Project name").fill(temporaryProjectName);
      await projectDialog
        .getByLabel("Target base URL")
        .fill(targetUrl);
      await projectDialog
        .getByRole("button", { name: "Create project" })
        .click();
      await page.getByRole("heading", { name: temporaryProjectName }).waitFor();
      const projectsResponse = await fetch(pageUrl(serverUrl, "/api/projects"));
      const projects = (await projectsResponse.json()) as ProjectSummary[];
      const temporaryProject = projects.find(
        (project) => project.name === temporaryProjectName,
      );
      assert.ok(temporaryProject);
      assert.equal(
        (
          await fetch(
            pageUrl(serverUrl, `/api/projects/${temporaryProject.id}`),
            { method: "DELETE" },
          )
        ).status,
        204,
      );
      await page.reload();
      await page.getByRole("heading", { name: "Projects" }).waitFor();
      await page
        .locator("aside")
        .getByText("GhostQA", { exact: true })
        .waitFor();

      const projectCard = page.locator("article").filter({ hasText: seeded.project.name }).first();
      await projectCard.getByRole("link", { name: "Open project" }).waitFor();
      await page.screenshot({ path: path.join(proofRoot, "02-projects.png"), fullPage: true });
      await projectCard.getByRole("link", { name: "Open project" }).click();

      await page.waitForURL(pageUrl(dashboardUrl, `/projects/${seeded.project.id}`));
      await page
        .getByRole("heading", { name: seeded.project.name, exact: true })
        .waitFor();
      await page.screenshot({ path: path.join(proofRoot, "03-project-detail.png"), fullPage: true });
      await page.getByRole("link", { name: "Open flow →" }).first().click();

      await page.getByRole("heading", { name: "Baseline journey" }).waitFor();
      for (const scenarioName of [
        "Double Action",
        "API Failure",
        "Slow Response",
        "Refresh",
        "Back",
        "Session Expiry",
      ]) {
        await page.getByRole("heading", { name: scenarioName }).waitFor();
      }
      const doubleActionCard = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name: "Double Action" }) });
      const doubleActionToggle = doubleActionCard.getByRole("checkbox");
      const doubleActionScenario = seeded.scenarios.find(
        (scenario) => scenario.scenarioKey === "double-action",
      );
      assert.ok(doubleActionScenario);
      const disabledResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().endsWith(`/api/scenarios/${doubleActionScenario.id}`),
      );
      await doubleActionToggle.click();
      const disabledResponse = await disabledResponsePromise;
      assert.equal(disabledResponse.status(), 200);
      assert.equal(
        ((await disabledResponse.json()) as { enabled: boolean }).enabled,
        false,
      );
      await doubleActionCard.getByText("Disabled", { exact: true }).waitFor();
      const enabledResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().endsWith(`/api/scenarios/${doubleActionScenario.id}`),
      );
      await doubleActionToggle.click();
      const enabledResponse = await enabledResponsePromise;
      assert.equal(enabledResponse.status(), 200);
      assert.equal(
        ((await enabledResponse.json()) as { enabled: boolean }).enabled,
        true,
      );
      await doubleActionCard.getByText("Enabled", { exact: true }).waitFor();
      await page.screenshot({ path: path.join(proofRoot, "04-flow-detail.png"), fullPage: true });

      const runButton = page.getByRole("button", { name: "Run tests" });
      await runButton.click();
      await page
        .getByRole("heading", { name: "Running GhostQA…", exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Running GhostQA…", exact: true })
          .isDisabled(),
        true,
      );
      await page.waitForURL(/\/runs\/[^/]+$/, { timeout: 180_000 });
      const runId = page.url().split("/").pop();
      assert.ok(runId);

      const runResponse = await fetch(pageUrl(serverUrl, `/api/runs/${runId}`));
      assert.equal(runResponse.status, 200);
      const run = (await runResponse.json()) as TestRunDetail;
      assert.equal(run.status, "COMPLETED");
      assert.equal(run.baselineResult?.status, "PASS");
      const statuses = new Map(
        run.scenarioResults.map((result) => [result.title, result.status]),
      );
      assert.equal(statuses.get("Double Action"), "FAIL");
      assert.equal(statuses.get("API Failure"), "FAIL");
      assert.equal(statuses.get("Refresh"), "FAIL");
      assert.equal(statuses.get("Session Expiry"), "FAIL");
      assert.ok(statuses.get("Slow Response"));
      assert.ok(statuses.get("Back"));

      await page.getByRole("heading", { name: "Behavior result summary" }).waitFor();
      const doubleActionLink = page
        .locator('a[href^="/results/"]')
        .filter({ hasText: "Double Action" });
      await doubleActionLink.getByText("FAIL", { exact: true }).waitFor();
      const resultHref = await doubleActionLink.getAttribute("href");
      assert.ok(resultHref);
      await page.screenshot({ path: path.join(proofRoot, "05-run-detail.png"), fullPage: true });

      await page
        .getByRole("navigation", { name: "Primary", exact: true })
        .getByRole("link", { name: "Runs" })
        .click();
      await page.getByRole("heading", { name: "Runs" }).waitFor();
      await page.getByRole("link", { name: run.flowName }).first().waitFor();
      await page.screenshot({ path: path.join(proofRoot, "06-runs.png"), fullPage: true });

      await page.goto(pageUrl(dashboardUrl, resultHref));
      await page.getByRole("heading", { name: "Double Action" }).waitFor();
      await page.getByRole("heading", { name: "Evidence summary" }).waitFor();
      const screenshot = page.getByAltText("Browser screenshot captured by GhostQA");
      await screenshot.waitFor({ state: "visible" });
      assert.ok(await screenshot.evaluate((image) => (image as HTMLImageElement).naturalWidth > 0));
      const screenshotUrl = await screenshot.getAttribute("src");
      assert.ok(screenshotUrl);
      assert.match(screenshotUrl, new RegExp(`^${serverUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/api/artifacts/`));
      const screenshotResponse = await fetch(screenshotUrl);
      assert.equal(screenshotResponse.status, 200);
      assert.match(screenshotResponse.headers.get("content-type") ?? "", /^image\//);
      assert.ok((await screenshotResponse.arrayBuffer()).byteLength > 0);

      const traceLink = page.getByRole("link", { name: "Download trace" });
      const traceUrl = await traceLink.getAttribute("href");
      assert.ok(traceUrl);
      assert.match(traceUrl, /\/api\/artifacts\//);
      const traceResponse = await fetch(traceUrl);
      assert.equal(traceResponse.status, 200);
      assert.match(traceResponse.headers.get("content-type") ?? "", /zip/);
      assert.ok((await traceResponse.arrayBuffer()).byteLength > 0);

      await page
        .getByRole("button", { name: "Open screenshot at full size" })
        .click();
      const screenshotDialog = page.getByRole("dialog", {
        name: "Expanded browser screenshot",
      });
      await screenshotDialog.waitFor();
      await page.keyboard.press("Escape");
      await screenshotDialog.waitFor({ state: "hidden" });
      await page.screenshot({ path: path.join(proofRoot, "07-fail-result.png") });

      await page.reload();
      await page.getByRole("heading", { name: "Double Action" }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
      );
      await page.screenshot({ path: path.join(proofRoot, "08-result-mobile.png"), fullPage: true });

      console.log(`Dashboard run: ${runId}`);
      console.log(`Baseline: ${run.baselineResult?.status ?? "missing"}`);
      for (const result of run.scenarioResults) {
        console.log(`${result.title}: ${result.status}`);
      }
      console.log(`Screenshot artifact: ${screenshotUrl}`);
      console.log(`Trace artifact: ${traceUrl}`);
      console.log(`Visual proof: ${proofRoot}`);
    } finally {
      await browser.close();
    }
  },
);
