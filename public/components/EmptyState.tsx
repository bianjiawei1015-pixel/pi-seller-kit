export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-hairline bg-surface/50 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pi-50 font-mono text-xl text-pi-600">
        π
      </div>
      <p className="text-[16px] font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-[24ch] text-[14px] text-muted">{body}</p>
      {action ? <div className="mt-5 w-full max-w-[220px]">{action}</div> : null}
    </div>
  );
}
