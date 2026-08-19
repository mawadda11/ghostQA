import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CaptureBaselinePage } from "./CaptureBaselinePage.js";

const api = vi.hoisted(() => ({
  getCapture: vi.fn(),
  stopCapture: vi.fn(),
  cancelCapture: vi.fn(),
  getProject: vi.fn(),
  createFlow: vi.fn(),
}));

vi.mock("../api/capture.js", () => ({
  getCapture: api.getCapture,
  stopCapture: api.stopCapture,
  cancelCapture: api.cancelCapture,
}));

vi.mock("../api/projects.js", () => ({
  getProject: api.getProject,
  createFlow: api.createFlow,
}));

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/projects/project-1/capture/capture-1"]}>
        <Routes>
          <Route
            element={<CaptureBaselinePage />}
            path="/projects/:projectId/capture/:captureId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getProject.mockResolvedValue({
    id: "project-1",
    name: "Portal",
    baseUrl: "http://127.0.0.1:9000/",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    flowCount: 0,
    runCount: 0,
  });
});

describe("captured baseline review", () => {
  it("renders active capture state with explicit stop and cancel controls", async () => {
    api.getCapture.mockResolvedValue({
      id: "capture-1",
      projectId: "project-1",
      status: "ACTIVE",
      targetUrl: "http://127.0.0.1:9000/",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    renderPage();
    expect(await screen.findByText("Capture active")).toBeTruthy();
    expect(screen.getByText(/Capture browser opened in a separate Chromium window/)).toBeTruthy();
    expect(screen.getByText(/check the taskbar/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stop capture" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("masks sensitive input and accepts a confirmed suggestion without a critical action", async () => {
    const user = userEvent.setup();
    api.getCapture.mockResolvedValue({
      id: "capture-1",
      projectId: "project-1",
      status: "READY",
      targetUrl: "http://127.0.0.1:9000/",
      startedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:01.000Z",
      draft: {
        suggestedId: "portal-capture",
        suggestedName: "Portal captured baseline",
        finalUrl: "http://127.0.0.1:9000/complete",
        successTextCandidates: ["Complete"],
        network: [],
        steps: [
          { id: "navigate-start", position: 0, action: "NAVIGATE", path: "/" },
          {
            id: "fill-access",
            position: 1,
            action: "FILL",
            locator: { kind: "LABEL", text: "Access value", exact: true },
            value: "captured-secret",
            sensitive: true,
          },
          {
            id: "click-confirm",
            position: 2,
            action: "CLICK",
            locator: { kind: "ROLE", role: "button", name: "Confirm", exact: true },
          },
        ],
        criticalActionCandidates: [
          {
            stepId: "click-confirm",
            label: "Confirm",
            request: { method: "POST", pathname: "/api/submissions" },
            reason: "A mutation request occurred immediately after this action.",
          },
        ],
      },
    });
    renderPage();
    const sensitive = await screen.findByDisplayValue("captured-secret");
    expect(sensitive.getAttribute("type")).toBe("password");
    expect(document.body.textContent).not.toContain("captured-secret");
    const save = screen.getByRole("button", { name: "Save baseline" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect((save as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Critical click") as HTMLSelectElement).value).toBe("");
  });

  it("shows one retained-diagnostics failure state after stop normalization fails", async () => {
    const user = userEvent.setup();
    const now = new Date().toISOString();
    api.getCapture
      .mockResolvedValueOnce({
        id: "capture-1",
        projectId: "project-1",
        status: "ACTIVE",
        targetUrl: "http://127.0.0.1:9000/",
        startedAt: now,
        updatedAt: now,
      })
      .mockResolvedValue({
        id: "capture-1",
        projectId: "project-1",
        status: "ERROR",
        targetUrl: "http://127.0.0.1:9000/",
        startedAt: now,
        updatedAt: now,
        errorMessage:
          "Captured click event 7 on /review had no stable unique locator.",
        diagnostics: {
          stage: "NORMALIZING",
          errorMessage:
            "Captured click event 7 on /review had no stable unique locator.",
          events: [
            {
              order: 7,
              kind: "CLICK",
              timestamp: now,
              pathname: "/review",
              locator: {},
            },
          ],
          network: [],
          finalPathname: "/confirmation/1",
        },
      });
    api.stopCapture.mockRejectedValue(new Error("normalization failed"));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Stop capture" }));
    expect(await screen.findByText("Capture failed")).toBeTruthy();
    expect(
      screen.getByText(
        "Captured click event 7 on /review had no stable unique locator.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Capture could not be stopped")).toBeNull();
    expect(screen.getByText(/Input values are not included/)).toBeTruthy();
  });
});
