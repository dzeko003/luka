import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ColumnDef, KbValue } from "@/db/schema";
import { placeFieldOf, type Place, type PlaceField } from "./connectors/places";
import { cityOfZone, fold, guessField, isKbField, type KbField, kbKey, norm, PERSONAL } from "./kb-fields";

export { cityOfZone, guessField, KB_FIELDS, KB_LABELS, type KbField, kbKey, MAX_CONTRIBUTION_ROWS } from "./kb-fields";

/*
 * Base Luka : annuaire des établissements, alimenté par les lignes validées des collectes (si l'utilisateur
 * accepte de les partager) et par les contributions approuvées par l'administrateur. Les collectes suivantes
 * la consultent avant de chercher ailleurs.
 *
 * Seules des informations publiques d'établissements y entrent : jamais de données sur des personnes.
 */

/** Champ de la base pour une colonne de collecte : celui choisi à la création, sinon deviné d'après le libellé. */
export function fieldOfColumn(col: ColumnDef): KbField | null {
  if (PERSONAL.test(` ${norm(`${col.name} ${col.label}`)} `)) return null;
  const f = placeFieldOf(col);
  if (f) return isKbField(f) ? f : null;
  return guessField(col.label) ?? guessField(col.name.replace(/_/g, " "));
}

const sameValue = (a: unknown, b: unknown) => {
  const x = fold(String(a ?? "")).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").replace(/[\s.\-()/]/g, "");
  const y = fold(String(b ?? "")).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").replace(/[\s.\-()/]/g, "");
  if (x === y) return true;
  const digits = /^\+?\d{7,}$/;
  return digits.test(x) && digits.test(y) && (x.replace("+", "").endsWith(y.replace("+", "")) || y.replace("+", "").endsWith(x.replace("+", "")));
};

/** Une ville écrite tout en minuscules ou en majuscules prend une majuscule à chaque mot (« pointe-noire » → « Pointe-Noire »). */
const cityName = (raw: string) => {
  const c = raw.trim().replace(/\s+/g, " ");
  return c === c.toLowerCase() || c === c.toUpperCase() ? c.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase()) : c;
};

/** Au-delà de cette durée, une valeur confirmée peut être remplacée par une valeur plus récente. */
const STALE_MS = 180 * 86_400_000;

export type KbRecord = { fields: Partial<Record<KbField, string | number>>; city: string; category?: string | null; url?: string | null };

/**
 * Ajoute ou complète des établissements. Une valeur retrouvée est confirmée une fois de plus ; une valeur
 * différente remplace l'ancienne seulement si celle-ci n'a été vue qu'une fois ou est ancienne.
 */
export async function upsertEntities(records: KbRecord[], src: string): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const valid = records
    .map((r) => ({ ...r, name: String(r.fields.nom ?? "").trim(), city: cityName(r.fields.ville ? String(r.fields.ville) : r.city) }))
    .filter((r) => r.name.length > 1 && r.name.length <= 150 && r.city.length > 1);

  for (let i = 0; i < valid.length; i += 200) {
    const batch = valid.slice(i, i + 200);
    const keys = [...new Set(batch.map((r) => kbKey(r.name, r.city)))];
    const existing = await db.select().from(schema.kbEntities).where(inArray(schema.kbEntities.key, keys));
    const byKey = new Map(existing.map((e) => [e.key, e]));

    for (const r of batch) {
      const key = kbKey(r.name, r.city);
      const incoming: Record<string, KbValue> = {};
      for (const [f, v] of Object.entries(r.fields)) {
        if (!isKbField(f) || v === undefined || v === null || String(v).trim() === "") continue;
        incoming[f] = { v: typeof v === "number" ? v : String(v).trim().slice(0, 500), n: 1, at: now, src, url: r.url ?? null };
      }
      const old = byKey.get(key);
      if (!old) {
        const [created] = await db
          .insert(schema.kbEntities)
          .values({ key, name: r.name, city: r.city, category: r.category ?? (incoming.categorie?.v as string | undefined) ?? null, fields: incoming })
          .onConflictDoNothing()
          .returning();
        if (created) {
          byKey.set(key, created);
          added++;
        }
        continue;
      }
      const fields = { ...old.fields };
      for (const [f, val] of Object.entries(incoming)) {
        const cur = fields[f];
        if (!cur) fields[f] = val;
        else if (sameValue(cur.v, val.v)) fields[f] = { ...cur, n: cur.n + 1, at: now };
        else if (cur.n <= 1 || Date.now() - Date.parse(cur.at) > STALE_MS) fields[f] = val;
      }
      const [saved] = await db
        .update(schema.kbEntities)
        .set({ fields, confirmations: old.confirmations + 1, category: old.category ?? r.category ?? null, updatedAt: new Date() })
        .where(eq(schema.kbEntities.id, old.id))
        .returning();
      byKey.set(key, saved);
      updated++;
    }
  }
  return { added, updated };
}

/**
 * Verse dans la base les lignes validées d'une collecte, si son propriétaire l'a accepté.
 * Les colonnes d'un fichier importé ne sont versées que pour un enrichissement partagé explicitement.
 */
export async function ingestValidatedRows(collecteId: string, rowIds?: string[]) {
  const [c] = await db
    .select({ shareData: schema.collectes.shareData, columns: schema.collectes.columns, zone: schema.collectes.zone, title: schema.collectes.title })
    .from(schema.collectes)
    .where(eq(schema.collectes.id, collecteId));
  if (!c?.shareData) return { added: 0, updated: 0 };
  const mapping = c.columns.map((col) => [col.name, fieldOfColumn(col)] as const).filter((m): m is readonly [string, KbField] => m[1] !== null);
  if (!mapping.some(([, f]) => f === "nom")) {
    // Sans colonne « nom » reconnue, la première colonne identifie l'établissement
    const first = c.columns[0];
    if (first && fieldOfColumn(first) === null && !PERSONAL.test(` ${norm(first.label)} `)) mapping.unshift([first.name, "nom"]);
  }
  if (!mapping.some(([, f]) => f === "nom")) return { added: 0, updated: 0 };
  const city = cityOfZone(c.zone);

  const conds = [eq(schema.rows.collecteId, collecteId), eq(schema.rows.status, "valide")];
  if (rowIds?.length) conds.push(inArray(schema.rows.id, rowIds));
  const rows = await db
    .select({ data: schema.rows.data, sourceUrl: schema.rows.sourceUrl, sourceTitle: schema.rows.sourceTitle })
    .from(schema.rows)
    .where(and(...conds));
  // Les conditions de Google Maps limitent la conservation de ses données : une ligne qui en vient n'entre pas dans la base
  const fromGoogle = (r: (typeof rows)[number]) => /google maps/i.test(r.sourceTitle ?? "") || /google\.[a-z.]+\/maps|maps\.google\./i.test(r.sourceUrl ?? "");
  const records: KbRecord[] = rows.filter((r) => !fromGoogle(r)).map((r) => {
    const fields: KbRecord["fields"] = {};
    for (const [col, f] of mapping) {
      const v = r.data[col];
      if (v !== null && v !== undefined && v !== "" && typeof v !== "boolean") fields[f] = v;
    }
    return { fields, city: city ?? "", url: r.sourceUrl };
  });
  return upsertEntities(records, "collecte");
}

/** Lance l'ingestion sans faire attendre l'utilisateur ; une erreur n'a aucun effet sur lui. */
export function ingestLater(collecteId: string, rowIds?: string[]) {
  void ingestValidatedRows(collecteId, rowIds).catch((e) => console.error(`[base] ingestion impossible : ${(e as Error).message}`));
}

/** Une fiche de la base, au format des sources de lieux. Confiance : 0,8, plus 0,05 par confirmation (0,95 au plus). */
export function entityToPlace(e: typeof schema.kbEntities.$inferSelect): { place: Place; confidence: number } {
  const fields: Place["fields"] = { nom: e.name, ville: e.city };
  for (const [f, val] of Object.entries(e.fields)) fields[f as PlaceField] = val.v;
  if (e.category && !fields.categorie) fields.categorie = e.category;
  const url = Object.values(e.fields).find((v) => v.url)?.url ?? "";
  return { place: { fields, url }, confidence: Math.min(0.95, 0.8 + 0.05 * (e.confirmations - 1)) };
}

/** Établissements connus d'une ville qui correspondent aux termes de la recherche (catégorie ou nom). */
export async function findInCity(city: string, terms: string[], limit: number) {
  const words = [...new Set(terms.flatMap((t) => norm(t).split(" ")).filter((w) => w.length > 3))].slice(0, 12);
  if (!city || !words.length || limit <= 0) return [];
  // Racine des mots (« pharmacies » → « pharmaci ») pour attraper singulier et pluriel
  const likes = words.map((w) => `%${w.replace(/(es|s|x)$/, "")}%`);
  const unaccent = (col: typeof schema.kbEntities.category | typeof schema.kbEntities.name) =>
    sql`translate(lower(coalesce(${col}, '')), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc')`;
  return db
    .select()
    .from(schema.kbEntities)
    .where(
      and(
        sql`translate(lower(${schema.kbEntities.city}), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') = ${norm(city)}`,
        or(...likes.flatMap((l) => [sql`${unaccent(schema.kbEntities.category)} like ${l}`, sql`${unaccent(schema.kbEntities.name)} like ${l}`])),
      ),
    )
    .orderBy(sql`${schema.kbEntities.confirmations} desc`)
    .limit(limit);
}

/** Établissements connus, retrouvés par leur nom exact dans une ville (enrichissement d'un fichier). */
export async function findByNames(city: string, names: string[]) {
  const keys = [...new Set(names.map((n) => kbKey(n, city)))];
  const found = new Map<string, typeof schema.kbEntities.$inferSelect>();
  for (let i = 0; i < keys.length; i += 500) {
    for (const e of await db.select().from(schema.kbEntities).where(inArray(schema.kbEntities.key, keys.slice(i, i + 500)))) found.set(e.key, e);
  }
  return found;
}

export async function kbSearch(q: string, limit = 50) {
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return db
    .select()
    .from(schema.kbEntities)
    .where(q ? or(ilike(schema.kbEntities.name, like), ilike(schema.kbEntities.city, like), ilike(schema.kbEntities.category, like)) : undefined)
    .orderBy(sql`${schema.kbEntities.updatedAt} desc`)
    .limit(limit);
}
