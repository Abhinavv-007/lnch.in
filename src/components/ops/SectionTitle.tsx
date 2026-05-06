import { type ReactNode } from "react";

export default function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-serif text-xl tracking-tight text-ink-100">{children}</h2>
        {hint ? <p className="text-xs text-ink-300">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
