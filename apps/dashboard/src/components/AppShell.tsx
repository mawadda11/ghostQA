import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";

import { getHealth } from "../api/projects.js";

const navigation = [
  { label: "Overview", to: "/" },
  { label: "Projects", to: "/projects" },
  { label: "Runs", to: "/runs" },
] as const;

const navClasses = ({ isActive }: { isActive: boolean }): string =>
  `rounded-lg px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? "bg-cyan-300/10 text-cyan-200"
      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
  }`;

export const AppShell = () => {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    retry: false,
    refetchInterval: 30_000,
  });
  const connection = health.isPending
    ? { label: "Checking API", color: "bg-slate-500" }
    : health.isSuccess
      ? { label: "API connected", color: "bg-emerald-400" }
      : { label: "API unavailable", color: "bg-rose-400" };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-800 bg-slate-950 px-5 py-7 md:flex md:flex-col">
          <NavLink className="flex items-center gap-3 px-2" to="/">
            <span className="grid size-9 place-items-center rounded-lg bg-cyan-300 font-black text-slate-950">
              G
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight">GhostQA</span>
              <span className="block text-xs text-slate-500">Behavior testing</span>
            </span>
          </NavLink>
          <nav aria-label="Primary" className="mt-9 flex flex-col gap-1">
            {navigation.map((item) => (
              <NavLink className={navClasses} end={item.to === "/"} key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900/55 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <span className={`size-2 rounded-full ${connection.color}`} />
              {connection.label}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Local V1 workspace · Chromium execution
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-3">
              <NavLink className="flex items-center gap-2 font-semibold" to="/">
                <span className="grid size-8 place-items-center rounded-lg bg-cyan-300 font-black text-slate-950">G</span>
                GhostQA
              </NavLink>
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <span className={`size-2 rounded-full ${connection.color}`} />
                {health.isSuccess ? "Connected" : "Offline"}
              </span>
            </div>
            <nav aria-label="Primary mobile" className="mt-3 flex gap-1 overflow-x-auto">
              {navigation.map((item) => (
                <NavLink className={navClasses} end={item.to === "/"} key={item.to} to={item.to}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </header>
          <main className="px-4 py-7 sm:px-7 lg:px-10 lg:py-9">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

