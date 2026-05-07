import { type ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? <p className="poster-eyebrow text-accent">{eyebrow}</p> : null}
        <h1 className="poster-headline poster-headline--md mt-1">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-fg-soft">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
