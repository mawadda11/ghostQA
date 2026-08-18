import { useEffect } from "react";

export const DialogFrame = ({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      aria-labelledby="dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/85 p-4"
      role="dialog"
    >
      <section className="my-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-white" id="dialog-title">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <button
            aria-label="Close dialog"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-xl text-slate-400 hover:bg-slate-800 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
};

