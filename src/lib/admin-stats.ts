import { desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ColumnDef } from "@/db/schema";
import { llmCostUsd } from "./config";

/* Requêtes de l'administration. Dans les sous-requêtes, la colonne de la requête principale est écrite
   en entier ("user"."id") : ${u.id} donnerait « "id" », que PostgreSQL rattacherait à la table de la sous-requête. */

export const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const iso = (d: Date) => d.toISOString();
const startOfMonthUtc = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
};
const startOfDayUtc = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const u = schema.user;
const c = schema.collectes;

/* ------------------------------ Utilisateurs ------------------------------ */

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: string;
  blocked: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  providers: string;
  collectes: number;
  logins: number;
  lastLoginAt: string | null;
  aiCostUsd: number;
  apify: number;
  revenue: number;
};

export async function listUsers(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: u.id,
      name: u.name,
      email: u.email,
      plan: u.plan,
      role: u.role,
      blocked: u.blocked,
      emailVerified: u.emailVerified,
      twoFactorEnabled: u.twoFactorEnabled,
      createdAt: u.createdAt,
      providers: sql<string>`coalesce((select string_agg(a.provider_id, ',') from account a where a.user_id = "user"."id"), '')`,
      collectes: sql<number>`(select count(*) from collectes x where x.user_id = "user"."id")`.mapWith(Number),
      logins: sql<number>`(select count(*) from logins l where l.user_id = "user"."id")`.mapWith(Number),
      lastLoginAt: sql<string | null>`(select max(l.created_at) from logins l where l.user_id = "user"."id")`,
      promptTokens: sql<number>`(select coalesce(sum(m.prompt_tokens), 0) from llm_usage m where m.user_id = "user"."id")`.mapWith(Number),
      completionTokens: sql<number>`(select coalesce(sum(m.completion_tokens), 0) from llm_usage m where m.user_id = "user"."id")`.mapWith(Number),
      apify: sql<number>`(select coalesce(sum(x.cost_usd), 0) from collectes x where x.user_id = "user"."id")`.mapWith(Number),
      revenue: sql<number>`(select coalesce(sum(p.amount), 0) from payments p where p.user_id = "user"."id")`.mapWith(Number),
    })
    .from(u)
    .orderBy(desc(u.createdAt))
    .limit(2000);
  return rows.map(({ promptTokens, completionTokens, ...r }) => ({
    ...r,
    createdAt: iso(r.createdAt),
    lastLoginAt: r.lastLoginAt ? iso(new Date(r.lastLoginAt)) : null,
    aiCostUsd: llmCostUsd(promptTokens, completionTokens),
  }));
}

/* ------------------------------ Collectes ------------------------------ */

export type AdminCollecte = {
  id: string;
  title: string;
  request: string;
  columns: ColumnDef[];
  status: string;
  tier: string;
  kind: string;
  error: string | null;
  maxRows: number;
  rows: number;
  tokens: number;
  aiCostUsd: number;
  costUsd: number;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  userId: string;
  userName: string;
  userEmail: string;
};

export async function listCollectes({ userId, limit = 100 }: { userId?: string; limit?: number } = {}): Promise<AdminCollecte[]> {
  const rows = await db
    .select({
      id: c.id,
      title: c.title,
      request: c.request,
      columns: c.columns,
      status: c.status,
      tier: c.tier,
      kind: c.kind,
      error: c.error,
      maxRows: c.maxRows,
      costUsd: c.costUsd,
      createdAt: c.createdAt,
      startedAt: c.startedAt,
      finishedAt: c.finishedAt,
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      rows: sql<number>`(select count(*) from rows r where r.collecte_id = "collectes"."id")`.mapWith(Number),
      promptTokens: sql<number>`(select coalesce(sum(m.prompt_tokens), 0) from llm_usage m where m.collecte_id = "collectes"."id")`.mapWith(Number),
      completionTokens: sql<number>`(select coalesce(sum(m.completion_tokens), 0) from llm_usage m where m.collecte_id = "collectes"."id")`.mapWith(Number),
    })
    .from(c)
    .innerJoin(u, eq(u.id, c.userId))
    .where(userId ? eq(c.userId, userId) : undefined)
    .orderBy(desc(c.createdAt))
    .limit(limit);
  return rows.map(({ promptTokens, completionTokens, ...r }) => ({
    ...r,
    tokens: promptTokens + completionTokens,
    aiCostUsd: llmCostUsd(promptTokens, completionTokens),
  }));
}

/* ------------------------------ Fiche utilisateur ------------------------------ */

export async function getUserDetail(id: string) {
  const [user] = await db.select().from(u).where(eq(u.id, id));
  if (!user) return null;
  const [providers, [ai], logins, [loginCount], payments, collectes] = await Promise.all([
    db.select({ providerId: schema.account.providerId }).from(schema.account).where(eq(schema.account.userId, id)),
    db
      .select({
        prompt: sql<number>`coalesce(sum(${schema.llmUsage.promptTokens}), 0)`.mapWith(Number),
        completion: sql<number>`coalesce(sum(${schema.llmUsage.completionTokens}), 0)`.mapWith(Number),
        calls: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.llmUsage)
      .where(eq(schema.llmUsage.userId, id)),
    db.select().from(schema.logins).where(eq(schema.logins.userId, id)).orderBy(desc(schema.logins.createdAt)).limit(10),
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        last30: sql<number>`count(*) filter (where ${schema.logins.createdAt} >= ${iso(daysAgo(30))}::timestamp)`.mapWith(Number),
      })
      .from(schema.logins)
      .where(eq(schema.logins.userId, id)),
    db
      .select({
        id: schema.payments.id,
        amount: schema.payments.amount,
        method: schema.payments.method,
        note: schema.payments.note,
        createdAt: schema.payments.createdAt,
        by: sql<string | null>`(select b.name from "user" b where b.id = "payments"."created_by")`,
      })
      .from(schema.payments)
      .where(eq(schema.payments.userId, id))
      .orderBy(desc(schema.payments.createdAt)),
    listCollectes({ userId: id, limit: 200 }),
  ]);
  return {
    user,
    providers: providers.map((p) => p.providerId),
    ai: { ...ai, tokens: ai.prompt + ai.completion, costUsd: llmCostUsd(ai.prompt, ai.completion) },
    logins,
    loginCount,
    payments,
    revenue: payments.reduce((n, p) => n + p.amount, 0),
    apify: collectes.reduce((n, x) => n + x.costUsd, 0),
    collectes,
  };
}

/* ------------------------------ Vue d'ensemble ------------------------------ */

export async function getOverview() {
  const since30 = iso(daysAgo(30));
  const v = schema.visits;
  const l = schema.logins;
  const p = schema.payments;
  const m = schema.llmUsage;
  const day = (col: unknown) => sql<string>`to_char(date_trunc('day', ${col}), 'YYYY-MM-DD')`;

  const [[users], [coll], [ai], [visits], visitsByDay, countries, [logins], loginsByDay, [revenue], recentPayments] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        premium: sql<number>`count(*) filter (where ${u.plan} = 'premium')`.mapWith(Number),
        blocked: sql<number>`count(*) filter (where ${u.blocked})`.mapWith(Number),
        new7: sql<number>`count(*) filter (where ${u.createdAt} >= ${iso(daysAgo(7))}::timestamp)`.mapWith(Number),
      })
      .from(u),
    db
      .select({
        today: sql<number>`count(*) filter (where ${c.createdAt} >= ${iso(startOfDayUtc())}::timestamp)`.mapWith(Number),
        last30: sql<number>`count(*) filter (where ${c.createdAt} >= ${since30}::timestamp)`.mapWith(Number),
        active: sql<number>`count(*) filter (where ${c.status} in ('pending', 'running'))`.mapWith(Number),
        failed30: sql<number>`count(*) filter (where ${c.status} = 'failed' and ${c.createdAt} >= ${since30}::timestamp)`.mapWith(Number),
        apify30: sql<number>`coalesce(sum(${c.costUsd}) filter (where ${c.createdAt} >= ${since30}::timestamp), 0)`.mapWith(Number),
      })
      .from(c),
    db
      .select({
        today: sql<number>`count(*) filter (where ${m.createdAt} >= ${iso(startOfDayUtc())}::timestamp)`.mapWith(Number),
        prompt: sql<number>`coalesce(sum(${m.promptTokens}), 0)`.mapWith(Number),
        completion: sql<number>`coalesce(sum(${m.completionTokens}), 0)`.mapWith(Number),
      })
      .from(m)
      .where(gte(m.createdAt, daysAgo(30))),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number), unique: sql<number>`count(distinct ${v.visitor})`.mapWith(Number) })
      .from(v)
      .where(gte(v.createdAt, daysAgo(30))),
    db
      .select({ day: day(v.createdAt), n: sql<number>`count(*)`.mapWith(Number) })
      .from(v)
      .where(gte(v.createdAt, daysAgo(30)))
      .groupBy(sql`1`),
    db
      .select({ country: v.country, n: sql<number>`count(*)`.mapWith(Number), unique: sql<number>`count(distinct ${v.visitor})`.mapWith(Number) })
      .from(v)
      .where(gte(v.createdAt, daysAgo(30)))
      .groupBy(v.country)
      .orderBy(desc(sql`2`))
      .limit(12),
    db
      .select({ total: sql<number>`count(*)`.mapWith(Number), users: sql<number>`count(distinct ${l.userId})`.mapWith(Number) })
      .from(l)
      .where(gte(l.createdAt, daysAgo(30))),
    db
      .select({ day: day(l.createdAt), n: sql<number>`count(*)`.mapWith(Number) })
      .from(l)
      .where(gte(l.createdAt, daysAgo(30)))
      .groupBy(sql`1`),
    db
      .select({
        total: sql<number>`coalesce(sum(${p.amount}), 0)`.mapWith(Number),
        month: sql<number>`coalesce(sum(${p.amount}) filter (where ${p.createdAt} >= ${iso(startOfMonthUtc())}::timestamp), 0)`.mapWith(Number),
        payers: sql<number>`count(distinct ${p.userId})`.mapWith(Number),
      })
      .from(p),
    db
      .select({ id: p.id, amount: p.amount, method: p.method, createdAt: p.createdAt, userId: u.id, name: u.name, email: u.email })
      .from(p)
      .innerJoin(u, eq(u.id, p.userId))
      .orderBy(desc(p.createdAt))
      .limit(5),
  ]);

  // 30 derniers jours, jours sans activité compris
  const days = Array.from({ length: 30 }, (_, i) => iso(daysAgo(29 - i)).slice(0, 10));
  const vMap = new Map(visitsByDay.map((r) => [r.day, r.n]));
  const lMap = new Map(loginsByDay.map((r) => [r.day, r.n]));
  const series = days.map((d) => ({ day: d, visits: vMap.get(d) ?? 0, logins: lMap.get(d) ?? 0 }));

  return {
    users,
    coll,
    ai: { ...ai, tokens: ai.prompt + ai.completion, costUsd: llmCostUsd(ai.prompt, ai.completion) },
    visits,
    countries,
    logins,
    series,
    revenue,
    recentPayments,
  };
}

/** Utilisé par la route de paiement : l'utilisateur existe-t-il ? */
export async function userExists(id: string) {
  const [x] = await db.select({ id: u.id }).from(u).where(eq(u.id, id));
  return Boolean(x);
}
