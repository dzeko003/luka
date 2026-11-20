import { and, asc, count, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ColumnDef, LogEntry, RefreshChanges } from "@/db/schema";
import { limits, type RefreshFrequency } from "./config";
import { refreshMail, sendMail } from "./mailer";
import { notify } from "./notifications";

/*
 * Mise à jour automatique d'une collecte : à l'échéance, le travailleur relance la même demande, puis
 * compare le résultat aux lignes existantes au lieu de les remplacer :
 *   - ligne inconnue → ajoutée, marquée « nouveau » ;
 *   - valeur différente → remplacée, l'ancienne gardée dans `previous`, ligne « modifie » et à revérifier ;
 *   - ligne absente du nouveau résultat → gardée, marquée « non_retrouve » (la recherche peut l'avoir manquée).
 * Les validations, rejets et corrections à la main de l'utilisateur sont conservés.
 */

type Value = string | number | boolean | null;
type FreshRow = { data: Record<string, Value>; sourceUrl: string | null; sourceTitle: string | null; confidence: number };
type Collecte = typeof schema.collectes.$inferSelect;

export const REFRESH_DAYS: Record<RefreshFrequency, number> = { hebdo: 7, mensuelle: 30 };
export const REFRESH_LABELS: Record<RefreshFrequency, string> = { hebdo: "chaque semaine", mensuelle: "chaque mois" };
export const isFrequency = (v: unknown): v is RefreshFrequency => v === "hebdo" || v === "mensuelle";

export const refreshRules = (plan: string | null | undefined) => (plan === "premium" ? limits.refresh.premium : limits.refresh.free);

export const nextRefreshDate = (freq: RefreshFrequency, from = new Date()) => new Date(from.getTime() + REFRESH_DAYS[freq] * 86_400_000);

const isEmpty = (v: Value | undefined) => v === null || v === undefined || v === "";

const keyOf = (v: Value | undefined) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Deux valeurs sont-elles la même information ? (casse, espaces, ponctuation des numéros et « https://www. » ignorés) */
const same = (a: Value | undefined, b: Value | undefined) => {
  const norm = (v: Value | undefined) =>
    String(v ?? "")
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "")
      .replace(/[\s.\-()/]/g, "");
  const [x, y] = [norm(a), norm(b)];
  if (x === y) return true;
  // Même valeur, simplement complétée (« Avenue Amilcar Cabral » → « Avenue Amilcar Cabral, Centre-Ville, Brazzaville »)
  const [fx, fy] = [fold(x).replace(/,/g, ""), fold(y).replace(/,/g, "")];
  if (Math.min(fx.length, fy.length) >= 8 && (fx.startsWith(fy) || fy.startsWith(fx))) return true;
  // Même numéro avec ou sans indicatif (« 06 111 11 11 » et « +242 06 111 11 11 »)
  const digits = /^\+?\d{7,}$/;
  if (digits.test(x) && digits.test(y)) {
    const [dx, dy] = [x.replace(/^\+/, ""), y.replace(/^\+/, "")];
    return dx.endsWith(dy) || dy.endsWith(dx);
  }
  return false;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Clé d'une ligne : la première colonne, et la ville si la collecte en a une (comme le dédoublonnage). */
function rowKey(columns: ColumnDef[]) {
  const first = columns[0].name;
  const city = columns.find((col, i) => i > 0 && /^(ville|city|commune|localite)$/.test(fold(col.name)))?.name;
  return (data: Record<string, Value>) => {
    const k = keyOf(data[first]);
    return k && city && keyOf(data[city]) ? `${k}|${keyOf(data[city])}` : k;
  };
}

/** Fusionne le résultat d'une mise à jour avec les lignes existantes et rend le bilan. */
export async function mergeRefresh(c: Collecte, fresh: FreshRow[]): Promise<RefreshChanges> {
  const key = rowKey(c.columns);
  // Les colonnes d'un fichier importé ne sont jamais comparées : elles viennent de l'utilisateur
  const compared = c.columns.filter((col) => !col.fromFile);
  const existing = await db
    .select({ id: schema.rows.id, data: schema.rows.data, status: schema.rows.status, edited: schema.rows.edited, position: schema.rows.position })
    .from(schema.rows)
    .where(eq(schema.rows.collecteId, c.id));

  const index = new Map<string, (typeof existing)[number]>();
  const nameOnly = new Map<string, (typeof existing)[number]>();
  for (const r of existing) {
    const k = key(r.data);
    if (!k) continue;
    if (!index.has(k)) index.set(k, r);
    if (!nameOnly.has(k.split("|")[0])) nameOnly.set(k.split("|")[0], r);
  }

  const changes: RefreshChanges = { nouveau: 0, modifie: 0, nonRetrouve: 0 };
  const seen = new Set<string>();
  const inserts: (typeof schema.rows.$inferInsert)[] = [];
  let position = existing.reduce((m, r) => Math.max(m, r.position), -1) + 1;

  await db.transaction(async (tx) => {
    // Les marques de la mise à jour précédente sont effacées
    await tx.update(schema.rows).set({ change: null, previous: null }).where(eq(schema.rows.collecteId, c.id));

    for (const f of fresh) {
      const k = key(f.data);
      if (!k) continue;
      const old = index.get(k) ?? (k.includes("|") ? undefined : nameOnly.get(k));
      if (!old) {
        if (seen.has(`new:${k}`)) continue;
        seen.add(`new:${k}`);
        inserts.push({ collecteId: c.id, data: f.data, sourceUrl: f.sourceUrl, sourceTitle: f.sourceTitle, confidence: f.confidence, position: position++, change: "nouveau" });
        changes.nouveau++;
        continue;
      }
      if (seen.has(old.id)) continue;
      seen.add(old.id);

      // Une valeur disparue n'est pas un changement : la source a pu simplement ne pas l'afficher cette fois
      const previous: Record<string, Value> = {};
      const data = { ...old.data };
      for (const col of compared) {
        if (old.edited.includes(col.name) || isEmpty(f.data[col.name]) || same(old.data[col.name], f.data[col.name])) continue;
        previous[col.name] = old.data[col.name] ?? null;
        data[col.name] = f.data[col.name];
      }
      if (!Object.keys(previous).length) continue;
      const rejected = old.status === "rejete";
      await tx
        .update(schema.rows)
        .set({
          data,
          previous,
          change: "modifie",
          // Une ligne rejetée le reste ; une ligne modifiée est à revérifier
          status: rejected ? old.status : "a_verifier",
          sourceUrl: f.sourceUrl,
          sourceTitle: f.sourceTitle,
          confidence: f.confidence,
        })
        .where(eq(schema.rows.id, old.id));
      if (!rejected) changes.modifie++;
    }

    // Lignes absentes du nouveau résultat (un fichier importé garde toujours toutes ses lignes)
    if (c.kind !== "enrichissement") {
      const missing = existing.filter((r) => !seen.has(r.id) && r.status !== "rejete").map((r) => r.id);
      for (let i = 0; i < missing.length; i += 1000) {
        await tx.update(schema.rows).set({ change: "non_retrouve" }).where(inArray(schema.rows.id, missing.slice(i, i + 1000)));
      }
      changes.nonRetrouve = missing.length;
    }
    for (let i = 0; i < inserts.length; i += 1000) await tx.insert(schema.rows).values(inserts.slice(i, i + 1000));
  });
  return changes;
}

export function changesSummary(ch: RefreshChanges) {
  const parts = [
    ch.nouveau && `${ch.nouveau} nouvelle(s) ligne(s)`,
    ch.modifie && `${ch.modifie} ligne(s) modifiée(s)`,
    ch.nonRetrouve && `${ch.nonRetrouve} ligne(s) non retrouvée(s)`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "aucun changement";
}

/** Fin d'une mise à jour réussie : prochaine échéance, notification et e-mail s'il y a du nouveau. */
export async function refreshDone(c: Collecte, changes: RefreshChanges) {
  const summary = changesSummary(changes);
  const any = changes.nouveau + changes.modifie + changes.nonRetrouve > 0;
  if (!any) return { summary };
  const href = `/collectes/${c.id}`;
  await notify(c.userId, { title: `Mise à jour : ${c.title}`, body: `${summary[0].toUpperCase()}${summary.slice(1)}.`, href });
  try {
    const [u] = await db.select({ email: schema.user.email, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, c.userId));
    const base = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    if (u) await sendMail({ to: u.email, ...refreshMail(u.name, `${base}${href}`, { title: c.title, summary }) });
  } catch (e) {
    console.error(`[mail] échec de l'e-mail de mise à jour : ${(e as Error).message}`);
  }
  return { summary };
}

/** Champs à remettre en place après une mise à jour (réussie ou non) : la collecte redevient « terminée ». */
export function refreshReset(c: Collecte) {
  const freq = isFrequency(c.refresh) ? c.refresh : null;
  return {
    status: "done",
    refreshing: false,
    error: null,
    progress: 100,
    finishedAt: new Date(),
    lastRefreshAt: new Date(),
    nextRefreshAt: freq ? nextRefreshDate(freq) : null,
  };
}

const logEntry = (message: string, level: LogEntry["level"] = "info") => [{ at: new Date().toISOString(), message, level }];

const startOfDayUtc = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Met dans la file les collectes dont la mise à jour est due. Une mise à jour est repoussée d'une heure si
 * l'utilisateur a déjà une collecte en cours, et au lendemain si Luka a atteint sa capacité du jour.
 * Les règles de la formule sont revérifiées ici : un compte repassé en gratuit garde une seule collecte suivie, chaque mois.
 */
export async function queueDueRefreshes() {
  const due = await db
    .select({ c: schema.collectes, plan: schema.user.plan, blocked: schema.user.blocked })
    .from(schema.collectes)
    .innerJoin(schema.user, eq(schema.user.id, schema.collectes.userId))
    .where(and(ne(schema.collectes.refresh, "aucune"), lte(schema.collectes.nextRefreshAt, new Date()), eq(schema.collectes.status, "done")))
    .orderBy(asc(schema.collectes.nextRefreshAt))
    .limit(20);
  if (!due.length) return;

  const [{ n: llmToday }] = await db.select({ n: count() }).from(schema.llmUsage).where(gte(schema.llmUsage.createdAt, startOfDayUtc()));
  const later = (ms: number) => new Date(Date.now() + ms);

  for (const { c, plan, blocked } of due) {
    const stop = (message: string) =>
      db
        .update(schema.collectes)
        .set({ refresh: "aucune", nextRefreshAt: null, log: sql`${schema.collectes.log} || ${JSON.stringify(logEntry(message, "warn"))}::jsonb` })
        .where(eq(schema.collectes.id, c.id));

    if (blocked) {
      await stop("Mise à jour automatique arrêtée : compte suspendu.");
      continue;
    }
    const rules = refreshRules(plan);
    const followed = await db
      .select({ id: schema.collectes.id })
      .from(schema.collectes)
      .where(and(eq(schema.collectes.userId, c.userId), ne(schema.collectes.refresh, "aucune")))
      .orderBy(asc(schema.collectes.createdAt));
    if (followed.findIndex((f) => f.id === c.id) >= rules.maxFollowed) {
      await stop(`Mise à jour automatique arrêtée : ta formule permet de suivre ${rules.maxFollowed} collecte(s).`);
      continue;
    }
    if (!(rules.frequencies as string[]).includes(c.refresh)) {
      await db.update(schema.collectes).set({ refresh: rules.frequencies[0] }).where(eq(schema.collectes.id, c.id));
      c.refresh = rules.frequencies[0];
    }
    if (llmToday >= limits.globalLlmCallsPerDay) {
      await db.update(schema.collectes).set({ nextRefreshAt: later(24 * 3_600_000) }).where(eq(schema.collectes.id, c.id));
      continue;
    }
    const [{ n: busy }] = await db
      .select({ n: count() })
      .from(schema.collectes)
      .where(and(eq(schema.collectes.userId, c.userId), inArray(schema.collectes.status, ["pending", "running"])));
    if (busy >= limits.maxConcurrentPerUser) {
      await db.update(schema.collectes).set({ nextRefreshAt: later(3_600_000) }).where(eq(schema.collectes.id, c.id));
      continue;
    }
    // La formule actuelle décide des sources (un compte repassé en gratuit n'utilise plus Google Maps)
    await db
      .update(schema.collectes)
      .set({
        status: "pending",
        refreshing: true,
        tier: plan === "premium" ? "premium" : "free",
        progress: 0,
        attempts: 0,
        error: null,
        startedAt: null,
        finishedAt: null,
        log: logEntry(`Mise à jour automatique (${REFRESH_LABELS[c.refresh as RefreshFrequency] ?? c.refresh}).`),
      })
      .where(and(eq(schema.collectes.id, c.id), eq(schema.collectes.status, "done")));
  }
}
