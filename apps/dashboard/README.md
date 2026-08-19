# GhostQA Dashboard

React + TypeScript + Vite + Tailwind CSS, with React Router and TanStack Query
for navigation and server state.

From the repository root:

```bash
npm run dashboard:dev
```

The dashboard opens at `http://127.0.0.1:5173` and connects to
`http://127.0.0.1:4000` by default. Set `VITE_GHOSTQA_API_URL` in the repository
`.env` when the API uses another origin. The server must allow the matching
dashboard origin through `DASHBOARD_ORIGINS`.

Routes:

- `/` — real workspace metrics and recent runs
- `/projects` and `/projects/:projectId` — project/flow registration
- `/projects/:projectId/capture/:captureId` — active capture and flow review
- `/flows/:flowId` — baseline journey, scenario plan, and run action
- `/runs` and `/runs/:runId` — persisted execution history and summaries
- `/results/:resultId` — structured evidence, screenshot, and trace access

**Capture baseline** is the primary first-flow workflow. It starts headed
Chromium through the API, reports session state, and provides a compact review
for semantic steps, locators, an optional critical action, step-bound
assertions, and an optional final assertion. After saving, **Replay baseline**
works without scenarios and **Build test plan** provides visual deterministic
configuration. Baseline/scenario JSON remains available under Advanced. All
flow and scenario inputs are validated by the V1 API.
The dashboard never constructs artifact paths; it retrieves files by artifact
ID through the server.
