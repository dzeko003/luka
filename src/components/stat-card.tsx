import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: "muted" | "accent" | "danger";
}) {
  const valueCls = tone === "accent" ? "text-accent" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-muted">{label}</p>
        <span className="icon-box">
          <Icon className="size-4" />
        </span>
      </div>
      <p className={`mt-1 text-[28px] leading-tight font-semibold tabular-nums ${valueCls}`}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}
