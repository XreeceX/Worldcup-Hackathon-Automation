export function EmptyState({
  icon = '⚽',
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="text-4xl opacity-60" aria-hidden>
        {icon}
      </span>
      <h3 className="text-lg font-bold">{title}</h3>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card h-48 animate-pulse bg-raised/50" />
      ))}
    </div>
  );
}
