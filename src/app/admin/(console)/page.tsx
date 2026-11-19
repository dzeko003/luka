import type { Metadata } from "next";
import Link from "next/link";
import { CollecteList } from "@/components/admin/collecte-list";
import { countryName, dateShort, fcfa, flag, int, PAYMENT_METHODS, usd, usdSmall } from "@/components/admin/format";
import { PageTitle, panel } from "@/components/admin/ui";
import { getOverview, listCollectes } from "@/lib/admin-stats";
import { requireConsoleAdmin } from "@/lib/auth";
import { limits } from "@/lib/config";

export const metadata: Metadata = { title: "Vue d'ensemble" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${panel} p-4`}>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((100 * used) / max)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {int(used)} <span className="text-muted">/ {int(max)}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max}>
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-warn" : "bg-chart"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const dayLabel = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Visites (barres pleines) et connexions (barres claires) des 30 derniers jours. */
function ActivityChart({ series }: { series: { day: string; visits: number; logins: number }[] }) {
  const max = Math.max(1, ...series.map((d) => Math.max(d.visits, d.logins)));
  const ticks = [0, 7, 14, 21, 29];
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Visites de la page d'accueil et connexions par jour, sur 30 jours">
        {series.map((d) => (
          <div
            key={d.day}
            className="group relative flex h-full flex-1 items-end justify-center gap-px"
            title={`${dayLabel.format(new Date(d.day))} : ${d.visits} visite(s), ${d.logins} connexion(s)`}
          >
            <span className="w-1/2 rounded-t-[2px] bg-chart" style={{ height: `${d.visits ? Math.max(3, (100 * d.visits) / max) : 0}%` }} />
            <span className="w-1/2 rounded-t-[2px] bg-chart-2" style={{ height: `${d.logins ? Math.max(3, (100 * d.logins) / max) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-border pt-2 text-[11.5px] text-muted">
        {ticks.map((i) => (
          <span key={i}>{dayLabel.format(new Date(series[i].day))}</span>
        ))}
      </div>
    </div>
  );
}

export default async function Page() {
  await requireConsoleAdmin();
  const [o, recent] = await Promise.all([getOverview(), listCollectes({ limit: 8 })]);
  const totalCountry = o.countries.reduce((n, c) => n + c.n, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle title="Vue d'ensemble">Visites, comptes, collectes, coûts et revenus de Luka sur les 30 derniers jours.</PageTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Visites de l'accueil" value={int(o.visits.total)} hint={`${int(o.visits.unique)} visiteurs uniques`} />
        <Stat label="Connexions" value={int(o.logins.total)} hint={`${int(o.logins.users)} utilisateur${o.logins.users > 1 ? "s" : ""} différent${o.logins.users > 1 ? "s" : ""}`} />
        <Stat label="Utilisateurs" value={int(o.users.total)} hint={`${o.users.new7} nouveau${o.users.new7 > 1 ? "x" : ""} en 7 jours · ${o.users.premium} premium`} />
        <Stat label="Revenus du mois" value={fcfa(o.revenue.month)} hint={`${fcfa(o.revenue.total)} au total · ${o.revenue.payers} client${o.revenue.payers > 1 ? "s" : ""}`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className={`${panel} p-4 lg:col-span-2`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold">Activité par jour</h2>
            <div className="flex gap-4 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px] bg-chart" /> Visites
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-[2px] bg-chart-2" /> Connexions
              </span>
            </div>
          </div>
          <ActivityChart series={o.series} />
        </section>

        <section className={`${panel} p-4`}>
          <h2 className="mb-3 text-[14px] font-semibold">Pays des visiteurs</h2>
          {o.countries.length === 0 ? (
            <p className="text-[13px] text-muted">Pas encore de visite enregistrée. Les visites de la page d&apos;accueil apparaîtront ici.</p>
          ) : (
            <ul className="space-y-2.5 text-[13px]">
              {o.countries.map((c) => {
                const pct = totalCountry ? Math.round((100 * c.n) / totalCountry) : 0;
                return (
                  <li key={c.country ?? "?"}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <span aria-hidden="true">{flag(c.country)}</span> {countryName(c.country)}
                      </span>
                      <span className="shrink-0 text-muted tabular-nums">
                        {int(c.n)} · {pct} %
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-chart" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className={`${panel} space-y-4 p-4 lg:col-span-2`}>
          <h2 className="text-[14px] font-semibold">Coûts</h2>
          <Meter label="Appels IA aujourd'hui (plafond global)" used={o.ai.today} max={limits.globalLlmCallsPerDay} />
          <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
            <div>
              <p className="text-[12.5px] text-muted">Coût IA (30 jours)</p>
              <p className="mt-1 text-[18px] font-semibold tabular-nums">{usdSmall(o.ai.costUsd)}</p>
              <p className="text-[12px] text-muted">{int(o.ai.tokens)} jetons, estimé</p>
            </div>
            <div>
              <p className="text-[12.5px] text-muted">Apify (30 jours)</p>
              <p className="mt-1 text-[18px] font-semibold tabular-nums">{usd(o.coll.apify30)}</p>
              <p className="text-[12px] text-muted">sources payantes</p>
            </div>
            <div>
              <p className="text-[12.5px] text-muted">Collectes (30 jours)</p>
              <p className="mt-1 text-[18px] font-semibold tabular-nums">{int(o.coll.last30)}</p>
              <p className="text-[12px] text-muted">
                {o.coll.failed30} échec{o.coll.failed30 > 1 ? "s" : ""} · {o.coll.active} en cours
              </p>
            </div>
          </div>
        </section>

        <section className={`${panel} p-4`}>
          <h2 className="mb-3 text-[14px] font-semibold">Derniers paiements</h2>
          {o.recentPayments.length === 0 ? (
            <p className="text-[13px] text-muted">
              Aucun paiement. Enregistre-les depuis la fiche d&apos;un{" "}
              <Link href="/admin/utilisateurs" className="underline underline-offset-2">
                utilisateur
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border text-[13px]">
              {o.recentPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/utilisateurs/${p.userId}`} className="min-w-0 hover:underline hover:underline-offset-2">
                    <span className="block truncate font-medium">{p.name || p.email}</span>
                    <span className="block text-[12px] text-muted">
                      {PAYMENT_METHODS[p.method] ?? p.method} · {dateShort.format(p.createdAt)}
                    </span>
                  </Link>
                  <span className="shrink-0 tabular-nums">{fcfa(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Dernières collectes</h2>
          <Link href="/admin/collectes" className="text-[12.5px] text-muted hover:text-text">
            Tout voir →
          </Link>
        </div>
        <CollecteList collectes={recent} />
      </section>
    </div>
  );
}
