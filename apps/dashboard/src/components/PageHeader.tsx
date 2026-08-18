export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) => (
  <header className="flex flex-col gap-5 border-b border-slate-800 pb-7 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow === undefined ? null : (
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {title}
      </h1>
      {description === undefined ? null : (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      )}
    </div>
    {actions === undefined ? null : (
      <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
    )}
  </header>
);

