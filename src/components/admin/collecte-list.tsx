import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { AdminCollecte } from "@/lib/admin-stats";
import { COLUMN_TYPES, dateTime, int, STATUS, usd, usdSmall } from "./format";
import { Badge } from "./ui";

/** Liste des collectes : un clic déplie la demande (prompt) et les colonnes demandées. */
export function CollecteList({ collectes, showUser = true }: { collectes: AdminCollecte[]; showUser?: boolean }) {
  if (collectes.length === 0) {
    return <p className="rounded-lg border border-border px-4 py-10 text-center text-[13px] text-muted">Aucune collecte pour l&apos;instant.</p>;
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {collectes.map((x) => {
        const s = STATUS[x.status] ?? { label: x.status, tone: "neutral" as const };
        const mins = x.startedAt && x.finishedAt ? Math.max(1, Math.round((x.finishedAt.getTime() - x.startedAt.getTime()) / 60_000)) : null;
        return (
          <li key={x.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3.5 shrink-0 text-muted transition-transform group-open:rotate-90" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{x.title}</span>
                    {x.kind === "enrichissement" && <Badge>Fichier complété</Badge>}
                    {x.tier === "premium" && <Badge tone="info">Premium</Badge>}
                  </span>
                  {showUser && <span className="block truncate text-[12px] text-muted">{x.userEmail}</span>}
                </span>
                <span className="hidden shrink-0 text-[12px] text-muted tabular-nums sm:block">
                  {int(x.rows)} ligne{x.rows > 1 ? "s" : ""} · {x.columns.length} colonne{x.columns.length > 1 ? "s" : ""}
                </span>
                <Badge tone={s.tone}>{s.label}</Badge>
                <span className="hidden w-[118px] shrink-0 text-right text-[12px] text-muted md:block">{dateTime.format(x.createdAt)}</span>
              </summary>

              <div className="space-y-4 border-t border-border bg-bg/50 px-4 py-4 pl-10 text-[13px]">
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-muted">{x.kind === "enrichissement" ? "Contenu du fichier" : "Demande"}</p>
                  <p className="rounded-md border border-border bg-surface px-3 py-2 leading-relaxed whitespace-pre-wrap">{x.request}</p>
                </div>
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-muted">Colonnes ({x.columns.length})</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {x.columns.map((col) => (
                      <li key={col.name} title={col.description} className="rounded-md border border-border-strong bg-surface px-2 py-1 text-[12px]">
                        {col.label} <span className="text-muted">· {COLUMN_TYPES[col.type] ?? col.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-4">
                  <div>
                    <dt className="text-muted">Lignes</dt>
                    <dd className="tabular-nums">
                      {int(x.rows)} / {int(x.maxRows)} demandées
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">IA</dt>
                    <dd className="tabular-nums">
                      {int(x.tokens)} jetons · {usdSmall(x.aiCostUsd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Apify</dt>
                    <dd className="tabular-nums">{x.costUsd ? usd(x.costUsd) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Durée</dt>
                    <dd className="tabular-nums">{mins ? `${mins} min` : "—"}</dd>
                  </div>
                </dl>
                {x.error && <p className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">{x.error}</p>}
                {showUser && (
                  <Link href={`/admin/utilisateurs/${x.userId}`} className="inline-flex text-[12.5px] font-medium underline underline-offset-2">
                    Voir la fiche de {x.userName || x.userEmail}
                  </Link>
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
