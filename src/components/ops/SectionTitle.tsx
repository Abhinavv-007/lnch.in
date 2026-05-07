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
      <div className="min-w-0">
        <h2 className="font-serif text-xl tracking-tight text-fg">{children}</h2>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
