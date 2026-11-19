import { desc, eq, gte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db, schema } from "@/db";
import { AdminUsers, type AdminUserRow } from "@/components/admin-users";
import { requireAdmin } from "@/lib/auth";
import { limits } from "@/lib/config";

export const metadata: Metadata = { title: "Administration" };

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const startOfDayUtc = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const usd = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
const int = (n: number) => n.toLocaleString("fr-FR");
const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Brazzaville" });

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "text-muted" },
  running: { label: "En cours", cls: "text-info" },
  done: { label: "Terminée", cls: "text-emerald-400" },
  failed: { label: "Échec", cls: "text-danger" },
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export default async function Page() {
  const admin = await requireAdmin();
  const c = schema.collectes;
  const u = schema.user;

  // Dans les sous-requêtes, les colonnes de la requête principale sont écrites en entier ("user"."id") :
  // ${u.id} donnerait « "id" », que PostgreSQL rattacherait à la table de la sous-requête.
  const [[users], [coll], [llm], userRows, recent] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        premium: sql<number>`count(*) filter (where ${u.plan} = 'premium')`.mapWith(Number),
        blocked: sql<number>`count(*) filter (where ${u.blocked})`.mapWith(Number),
        new7: sql<number>`count(*) filter (where ${u.createdAt} >= ${daysAgo(7).toISOString()}::timestamp)`.mapWith(Number),
      })
      .from(u),
    db
      .select({
        today: sql<number>`count(*) filter (where ${c.createdAt} >= ${startOfDayUtc().toISOString()}::timestamp)`.mapWith(Number),
        week: sql<number>`count(*) filter (where ${c.createdAt} >= ${daysAgo(7).toISOString()}::timestamp)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${c.status} in ('pending', 'running'))`.mapWith(Number),
        failed7: sql<number>`count(*) filter (where ${c.status} = 'failed' and ${c.createdAt} >= ${daysAgo(7).toISOString()}::timestamp)`.mapWith(Number),
        apify30: sql<number>`coalesce(sum(${c.costUsd}) filter (where ${c.createdAt} >= ${daysAgo(30).toISOString()}::timestamp), 0)`.mapWith(Number),
      })
      .from(c),
    db
      .select({
        today: sql<number>`count(*) filter (where ${schema.llmUsage.createdAt} >= ${startOfDayUtc().toISOString()}::timestamp)`.mapWith(Number),
        tokens30: sql<number>`coalesce(sum(${schema.llmUsage.promptTokens} + ${schema.llmUsage.completionTokens}), 0)`.mapWith(Number),
      })
      .from(schema.llmUsage)
      .where(gte(schema.llmUsage.createdAt, daysAgo(30))),
    db
      .select({
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan,
        role: u.role,
        blocked: u.blocked,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        providers: sql<string>`coalesce((select string_agg(a.provider_id, ',') from account a where a.user_id = "user"."id"), '')`,
        collectes: sql<number>`(select count(*) from collectes x where x.user_id = "user"."id")`.mapWith(Number),
        lastCollecte: sql<string | null>`(select max(x.created_at) from collectes x where x.user_id = "user"."id")`,
        apify: sql<number>`(select coalesce(sum(x.cost_usd), 0) from collectes x where x.user_id = "user"."id")`.mapWith(Number),
      })
      .from(u)
      .orderBy(desc(u.createdAt))
      .limit(500),
    db
      .select({
        id: c.id,
        title: c.title,
        status: c.status,
        tier: c.tier,
        costUsd: c.costUsd,
        error: c.error,
        createdAt: c.createdAt,
        startedAt: c.startedAt,
        finishedAt: c.finishedAt,
        email: u.email,
        rows: sql<number>`(select count(*) from rows r where r.collecte_id = "collectes"."id")`.mapWith(Number),
      })
      .from(c)
      .innerJoin(u, eq(u.id, c.userId))
      .orderBy(desc(c.createdAt))
      .limit(30),
  ]);

  const rows: AdminUserRow[] = userRows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastCollecte: r.lastCollecte ? new Date(r.lastCollecte).toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Administration</h1>
        <p className="text-[13px] text-muted">Utilisateurs, collectes et coûts. Visible uniquement par les administrateurs.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Utilisateurs" value={int(users.total)} hint={`${users.new7} nouveau(x) en 7 jours`} />
        <Stat label="Premium" value={int(users.premium)} hint={users.blocked ? `${users.blocked} suspendu(s)` : "aucun compte suspendu"} />
        <Stat label="Collectes aujourd'hui" value={int(coll.today)} hint={`${coll.week} en 7 jours · ${coll.active} en cours`} />
        <Stat label="Échecs (7 jours)" value={int(coll.failed7)} hint={coll.week ? `${Math.round((100 * coll.failed7) / coll.week)} % des collectes` : undefined} />
        <Stat label="Dépense Apify (30 jours)" value={usd(coll.apify30)} hint={`plafond ${usd(Number(process.env.APIFY_MAX_USD_PER_COLLECTE ?? 5))} par collecte`} />
        <Stat label="Appels IA aujourd'hui" value={int(llm.today)} hint={`plafond global : ${int(limits.globalLlmCallsPerDay)} par jour`} />
        <Stat label="Jetons IA (30 jours)" value={int(llm.tokens30)} />
      </div>

      <AdminUsers users={rows} currentAdminId={admin.id} />

      <section className="card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold">Dernières collectes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[12px] text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Collecte</th>
                <th className="px-4 py-2 font-medium">Utilisateur</th>
                <th className="px-4 py-2 font-medium">Statut</th>
                <th className="px-4 py-2 text-right font-medium">Lignes</th>
                <th className="px-4 py-2 text-right font-medium">Apify</th>
                <th className="px-4 py-2 text-right font-medium">Durée</th>
                <th className="px-4 py-2 font-medium">Créée</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
                    Aucune collecte pour l&apos;instant.
                  </td>
                </tr>
              )}
              {recent.map((r) => {
                const s = STATUS[r.status] ?? { label: r.status, cls: "" };
                const mins = r.startedAt && r.finishedAt ? Math.max(1, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 60_000)) : null;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="max-w-[260px] truncate px-4 py-2" title={r.error ?? r.title}>
                      {r.title}
                      {r.tier === "premium" && <span className="ml-1.5 rounded bg-accent-soft px-1 text-[10px] text-accent">Premium</span>}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2 text-muted">{r.email}</td>
                    <td className={`px-4 py-2 ${s.cls}`}>{s.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{int(r.rows)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.costUsd ? usd(r.costUsd) : "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{mins ? `${mins} min` : "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-muted">{dateFmt.format(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
