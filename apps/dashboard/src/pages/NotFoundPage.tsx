import { Link } from "react-router-dom";

export const NotFoundPage = () => (
  <div className="grid min-h-[65vh] place-items-center text-center">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">Page not found</h1>
      <p className="mt-3 text-sm text-slate-400">This GhostQA dashboard route does not exist.</p>
      <Link className="mt-6 inline-flex rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950" to="/">Return to overview</Link>
    </div>
  </div>
);

