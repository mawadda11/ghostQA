const scenarioFamilies = [
  "Double Action",
  "API Failure",
  "Slow Response",
  "Refresh / Back Navigation",
  "Session Expiry",
] as const;

const navigation = ["Overview", "Projects", "Runs"] as const;

export const App = () => (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 border-r border-white/8 bg-slate-950/80 px-5 py-7 md:flex md:flex-col">
        <div className="flex items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950 shadow-lg shadow-cyan-400/15">
            G
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">GhostQA</p>
            <p className="text-xs text-slate-500">Behavior testing</p>
          </div>
        </div>

        <nav aria-label="Primary" className="mt-10">
          <ul className="space-y-1">
            {navigation.map((item, index) => (
              <li key={item}>
                <a
                  className={`block rounded-lg px-3 py-2.5 text-sm transition ${
                    index === 0
                      ? "bg-white/8 font-medium text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                  href={`#${item.toLowerCase()}`}
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Phase 1 foundation
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Deterministic browser execution will be connected in a later phase.
          </p>
        </div>
      </aside>

      <main className="relative flex-1 overflow-hidden px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
        <div className="pointer-events-none absolute -right-32 -top-40 size-[34rem] rounded-full bg-cyan-400/8 blur-3xl" />

        <header className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:hidden">
            <div className="grid size-9 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">
              G
            </div>
            <span className="font-semibold">GhostQA</span>
          </div>
          <div className="ml-auto rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400">
            Local workspace
          </div>
        </header>

        <section className="relative mt-14 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Adaptive web behavior testing
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
            Browser evidence for the failures users actually encounter.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Replay a known-good flow under realistic failure and navigation
            conditions, then inspect evidence-backed results.
          </p>
        </section>

        <section aria-label="Workspace summary" className="relative mt-10 grid gap-3 sm:grid-cols-3">
          {[
            ["Projects", "0", "Ready for configuration"],
            ["Baseline flows", "0", "Validation comes first"],
            ["Scenario families", "5", "Fixed V1 scope"],
          ].map(([label, value, note]) => (
            <article
              key={label}
              className="rounded-2xl border border-white/8 bg-white/[0.035] p-5 backdrop-blur"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {value}
              </p>
              <p className="mt-3 text-xs text-slate-500">{note}</p>
            </article>
          ))}
        </section>

        <section className="relative mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <article className="rounded-2xl border border-white/8 bg-slate-900/60 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Projects</p>
                <p className="mt-1 text-sm text-slate-500">
                  Targets are restricted to localhost or explicit staging hosts.
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                Empty workspace
              </span>
            </div>

            <div className="mt-10 rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
              <div className="mx-auto grid size-11 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-xl text-cyan-300">
                +
              </div>
              <h2 className="mt-4 font-medium text-white">No projects configured</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Project creation and baseline flow registration are the next
                application phase.
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-white/8 bg-slate-900/60 p-6 sm:p-8">
            <p className="text-sm font-medium text-white">V1 scenario families</p>
            <p className="mt-1 text-sm text-slate-500">
              Deliberately constrained to five behaviors.
            </p>
            <ol className="mt-6 space-y-3">
              {scenarioFamilies.map((scenario, index) => (
                <li
                  key={scenario}
                  className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.025] px-4 py-3"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-800 text-xs font-medium text-cyan-300">
                    {index + 1}
                  </span>
                  <span className="text-sm text-slate-300">{scenario}</span>
                </li>
              ))}
            </ol>
          </article>
        </section>
      </main>
    </div>
  </div>
);
