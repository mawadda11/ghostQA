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
- `/flows/:flowId` — baseline journey, scenario plan, and run action
- `/runs` and `/runs/:runId` — persisted execution history and summaries
- `/results/:resultId` — structured evidence, screenshot, and trace access

Normalized flow and scenario JSON imports are validated by the Phase 4 API.
The dashboard never constructs artifact paths; it retrieves files by artifact
ID through the server.
