import { Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell.js";
import { FlowDetailPage } from "./pages/FlowDetailPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";
import { ResultDetailPage } from "./pages/ResultDetailPage.js";
import { RunDetailPage } from "./pages/RunDetailPage.js";
import { RunsPage } from "./pages/RunsPage.js";

export const App = () => (
  <Routes>
    <Route element={<AppShell />}>
      <Route element={<OverviewPage />} index />
      <Route element={<ProjectsPage />} path="projects" />
      <Route element={<ProjectDetailPage />} path="projects/:projectId" />
      <Route element={<FlowDetailPage />} path="flows/:flowId" />
      <Route element={<RunsPage />} path="runs" />
      <Route element={<RunDetailPage />} path="runs/:runId" />
      <Route element={<ResultDetailPage />} path="results/:resultId" />
      <Route element={<NotFoundPage />} path="*" />
    </Route>
  </Routes>
);
