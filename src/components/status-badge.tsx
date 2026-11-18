const styles: Record<string, [string, string]> = {
  pending: ["Dans la file", "bg-surface-2 text-muted"],
  running: ["En cours", "bg-info-soft text-info"],
  done: ["Terminée", "bg-accent-soft text-accent"],
  failed: ["Échec", "bg-danger-soft text-danger"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = styles[status] ?? [status, "bg-surface-2 text-muted"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status === "running" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {label}
    </span>
  );
}
