import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { ArrowUpRight, Database, Download, Gauge, Layers, Link2, ListChecks, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { checkCollecteQuota } from "@/lib/quotas";

export const metadata: Metadata = { title: "Mes collectes" };

const FILTERS = [
  { v: "", l: "Toutes" },
  { v: "done", l: "Terminées" },
  { v: "running", l: "En cours" },
  { v: "failed", l: "En échec" },
] as const;
type Status = (typeof schema.collectes.$inferSelect)["status"];

export default async function Dashboard({ searchParams }: PageProps<"/tableau-de-bord">) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const statut = FILTERS.find((f) => f.v && f.v === sp.statut)?.v as Status | undefined;

  const c = schema.collectes;
  const weekAgo = sql`now() - interval '7 days'`;
  const where = and(
    eq(c.userId, user.id),
    q ? ilike(c.title, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
    statut ? eq(c.status, statut) : undefined,
  );

  const [list, [stats], [rowStats], quota] = await Promise.all([
    db
      .select({ id: c.id, title: c.title, columns: c.columns, status: c.status, createdAt: c.createdAt, nbRows: count(schema.rows.id) })
      .from(c)
      .leftJoin(schema.rows, eq(schema.rows.collecteId, c.id))
      .where(where)
      .groupBy(c.id)
      .orderBy(desc(c.createdAt))
      .limit(100),
    db
      .select({
        total: count(),
        week: sql<number>`count(*) filter (where ${c.createdAt} >= ${weekAgo})`.mapWith(Number),
        done: sql<number>`count(*) filter (where ${c.status} = 'done')`.mapWith(Number),
        failed: sql<number>`count(*) filter (where ${c.status} = 'failed')`.mapWith(Number),
      })
      .from(c)
      .where(eq(c.userId, user.id)),
    db
      .select({
        total: count(),
        valides: sql<number>`count(*) filter (where ${schema.rows.status} = 'valide')`.mapWith(Number),
        week: sql<number>`count(*) filter (where ${c.createdAt} >= ${weekAgo})`.mapWith(Number),
      })
      .from(schema.rows)
      .innerJoin(c, eq(schema.rows.collecteId, c.id))
      .where(eq(c.userId, user.id)),
    checkCollecteQuota(user),
  ]);

  const finished = stats.done + stats.failed;
  const successRate = finished ? Math.round((stats.done / finished) * 1000) / 10 : null;
  const left = Math.max(0, quota.limitPerDay - quota.usedToday);
  const firstName = user.name.split(" ")[0];
  const filterHref = (v: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (v) p.set("statut", v);
    const s = p.toString();
    return s ? `/tableau-de-bord?${s}` : "/tableau-de-bord";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Bonjour {firstName}</h1>
          <p className="text-[13px] text-muted">Voici l&apos;état de tes collectes de données.</p>
        </div>
        <Link href="/collectes/nouvelle" className="btn-primary">
          <Plus className="size-4" /> Nouvelle collecte
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collectes" value={stats.total} icon={Layers} hint={`+${stats.week} ces 7 derniers jours`} />
        <StatCard
          label="Lignes collectées"
          value={rowStats.total.toLocaleString("fr-FR")}
          icon={Database}
          hint={`${rowStats.valides.toLocaleString("fr-FR")} validée(s) · +${rowStats.week} cette semaine`}
        />
        <StatCard
          label="Restantes aujourd'hui"
          value={
            <>
              {left}
              <span className="text-base font-normal text-muted"> / {quota.limitPerDay}</span>
            </>
          }
          icon={Gauge}
          hint="Le compteur repart à zéro chaque jour"
        />
        <StatCard
          label="Taux de réussite"
          value={successRate === null ? "—" : `${successRate.toLocaleString("fr-FR")} %`}
          icon={ListChecks}
          tone={successRate !== null && successRate < 50 ? "danger" : "muted"}
          hint={`${stats.done} terminée(s) · ${stats.failed} en échec`}
        />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
          <h2 className="mr-auto text-[15px] font-semibold">Collectes récentes</h2>
          <form action="/tableau-de-bord" className="relative w-full sm:w-56" role="search">
            {statut && <input type="hidden" name="statut" value={statut} />}
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Rechercher"
              aria-label="Rechercher une collecte"
              className="input py-1.5 pl-8 text-[13px]"
            />
          </form>
          <details className="relative">
            <summary className="btn-ghost cursor-pointer list-none py-1.5 [&::-webkit-details-marker]:hidden">
              <SlidersHorizontal className="size-3.5" /> {statut ? FILTERS.find((f) => f.v === statut)?.l : "Filtres"}
            </summary>
            <div className="card absolute right-0 z-10 mt-1 w-40 overflow-hidden py-1 shadow-lg shadow-black/5">
              {FILTERS.map((f) => (
                <Link
                  key={f.v}
                  href={filterHref(f.v)}
                  className={`block px-3 py-1.5 text-[13px] hover:bg-surface-2 ${(statut ?? "") === f.v ? "font-medium text-accent" : ""}`}
                >
                  {f.l}
                </Link>
              ))}
            </div>
          </details>
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="icon-box size-11">
              <Database className="size-5" />
            </span>
            {q || statut ? (
              <>
                <p className="mt-4 font-semibold">Aucune collecte ne correspond</p>
                <Link href="/tableau-de-bord" className="mt-2 text-[13px] text-accent hover:underline">
                  Effacer la recherche
                </Link>
              </>
            ) : (
              <>
                <p className="mt-4 font-semibold">Aucune collecte pour l&apos;instant</p>
                <p className="mt-1 max-w-sm text-[13px] text-muted">
                  Décris les données que tu cherches, ou pars d&apos;un modèle dans le menu de gauche.
                </p>
                <Link href="/collectes/nouvelle" className="btn-primary mt-5">
                  <Plus className="size-4" /> Créer ma première collecte
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead className="bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Collecte</th>
                  <th className="px-4 py-2.5 font-medium">Colonnes</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 text-right font-medium">Lignes</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-5 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-2/60">
                    <td className="max-w-72 px-5 py-3">
                      <Link href={`/collectes/${r.id}`} className="flex items-center gap-2 font-medium hover:text-accent">
                        <Link2 className="size-3.5 shrink-0 text-muted" />
                        <span className="truncate">{r.title}</span>
                      </Link>
                    </td>
                    <td className="max-w-64 truncate px-4 py-3 text-muted">
                      {r.columns.map((col) => col.label).join(", ")}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {r.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.nbRows}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {r.nbRows > 0 && (
                          <a
                            href={`/api/collectes/${r.id}/export?format=csv`}
                            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
                            aria-label={`Télécharger ${r.title} en CSV`}
                            title="Télécharger en CSV"
                          >
                            <Download className="size-4" />
                          </a>
                        )}
                        <Link
                          href={`/collectes/${r.id}`}
                          className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
                          aria-label={`Ouvrir ${r.title}`}
                          title="Ouvrir"
                        >
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
