import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectDetailPage } from "./ProjectDetailPage.js";

const api = vi.hoisted(() => ({
  getProject: vi.fn(),
  listProjectFlows: vi.fn(),
  listProjectRuns: vi.fn(),
  updateProject: vi.fn(),
  createFlow: vi.fn(),
  startCapture: vi.fn(),
}));

vi.mock("../api/projects.js", () => ({
  getProject: api.getProject,
  listProjectFlows: api.listProjectFlows,
  updateProject: api.updateProject,
  createFlow: api.createFlow,
}));
vi.mock("../api/runs.js", () => ({ listProjectRuns: api.listProjectRuns }));
vi.mock("../api/capture.js", () => ({ startCapture: api.startCapture }));

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/projects/project-1"]}>
        <Routes>
          <Route element={<ProjectDetailPage />} path="/projects/:projectId" />
          <Route element={<div>Capture route</div>} path="/projects/:projectId/capture/:captureId" />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  api.getProject.mockResolvedValue({
    id: "project-1",
    name: "Story application",
    baseUrl: "http://127.0.0.1:9000/",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    flowCount: 2,
    runCount: 2,
  });
  api.listProjectRuns.mockResolvedValue([]);
  api.startCapture.mockResolvedValue({
    id: "capture-2",
    projectId: "project-1",
    status: "ACTIVE",
    targetUrl: "http://127.0.0.1:9000/",
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
});

describe("project multi-flow experience", () => {
  it("shows every flow and starts another capture for the same project", async () => {
    api.listProjectFlows.mockResolvedValue([
      { id: "publish", projectId: "project-1", name: "Publish story", stepCount: 4, scenarioCount: 3, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "browse", projectId: "project-1", name: "Browse stories", stepCount: 2, scenarioCount: 1, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    renderPage();
    expect(await screen.findByText("Publish story")).toBeTruthy();
    expect(screen.getByText("Browse stories")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Capture another flow" }));
    expect(api.startCapture).toHaveBeenCalledWith("project-1");
    expect(await screen.findByText("Capture route")).toBeTruthy();
  });

  it("labels the empty-project primary action as Capture first flow", async () => {
    api.getProject.mockResolvedValue({
      ...(await api.getProject()),
      flowCount: 0,
    });
    api.listProjectFlows.mockResolvedValue([]);
    renderPage();
    expect(await screen.findAllByRole("button", { name: "Capture first flow" })).toHaveLength(2);
  });
});
