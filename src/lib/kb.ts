import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ColumnDef, KbValue } from "@/db/schema";
import { placeFieldOf, type Place, type PlaceField } from "./connectors/places";
import {
  acceptsField,
  cityOfZone,
  type EntityType,
  entityKey,
  fold,
  guessField,
  isExtraKey,
  isKbField,
  type KbField,
  kbKey,
  norm,
  PERSONAL,
  type Relation,
} from "./kb-fields";

export { cityOfZone, ENTITY_TYPES, type EntityType, guessField, KB_FIELDS, KB_LABELS, type KbField, kbKey, MAX_CONTRIBUTION_ROWS } from "./kb-fields";

const e = schema.entities;
const isPlace = eq(e.type, "lieu");

/*
 * Base Luka : fiches communes de lieux, d'organisations, de personnes et de publications, reliées entre elles.
 * Les lieux viennent des lignes validées des collectes (si l'utilisateur accepte de les partager) et des
 * contributions approuvées par l'administrateur ; les collectes suivantes les consultent avant de chercher ailleurs.
 *
 * Seules des informations publiques y entrent. Une personne n'y figure que sous son identité professionnelle
 * publique (nom de signature, ORCID, discipline, affiliation) : jamais de téléphone, d'e-mail, d'adresse ni de
 * photo, et sa fiche est retirée sur simple demande.
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

export type KbRecord = { fields: Partial<Record<string, string | number>>; city: string; category?: string | null; url?: string | null };

/** Fusionne des valeurs reçues dans une fiche : confirme une valeur retrouvée, remplace une valeur peu sûre ou ancienne. */
function mergeFields(old: Record<string, KbValue>, incoming: Record<string, KbValue>, now: string) {
  const fields = { ...old };
  for (const [f, val] of Object.entries(incoming)) {
    const cur = fields[f];
    if (!cur) fields[f] = val;
    else if (sameValue(cur.v, val.v)) fields[f] = { ...cur, n: cur.n + 1, at: now };
    else if (cur.n <= 1 || Date.now() - Date.parse(cur.at) > STALE_MS) fields[f] = val;
  }
  return fields;
}

/**
 * Ajoute ou complète des lieux. Une valeur retrouvée est confirmée une fois de plus ; une valeur
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
    const existing = await db.select().from(e).where(and(isPlace, inArray(e.key, keys)));
    const byKey = new Map(existing.map((e) => [e.key, e]));

    for (const r of batch) {
      const key = kbKey(r.name, r.city);
      const incoming: Record<string, KbValue> = {};
      for (const [f, v] of Object.entries(r.fields)) {
        if (!(isKbField(f) || isExtraKey(f)) || v === undefined || v === null || String(v).trim() === "") continue;
        incoming[f] = { v: typeof v === "number" ? v : String(v).trim().slice(0, 500), n: 1, at: now, src, url: r.url ?? null };
      }
      const old = byKey.get(key);
      if (!old) {
        const [created] = await db
          .insert(schema.entities)
          .values({ type: "lieu", key, name: r.name, city: r.city, category: r.category ?? (incoming.categorie?.v as string | undefined) ?? null, fields: incoming })
          .onConflictDoNothing()
          .returning();
        if (created) {
          byKey.set(key, created);
          added++;
        }
        continue;
      }
      const fields = mergeFields(old.fields, incoming, now);
      const [saved] = await db
        .update(schema.entities)
        .set({ fields, confirmations: old.confirmations + 1, category: old.category ?? r.category ?? null, updatedAt: new Date() })
        .where(eq(schema.entities.id, old.id))
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
export function entityToPlace(x: typeof schema.entities.$inferSelect): { place: Place; confidence: number } {
  const fields: Place["fields"] = { nom: x.name, ville: x.city ?? "" };
  for (const [f, val] of Object.entries(x.fields)) fields[f as PlaceField] = val.v;
  if (x.category && !fields.categorie) fields.categorie = x.category;
  const url = Object.values(x.fields).find((v) => v.url)?.url ?? "";
  return { place: { fields, url }, confidence: Math.min(0.95, 0.8 + 0.05 * (x.confirmations - 1)) };
}

/** Établissements connus d'une ville qui correspondent aux termes de la recherche (catégorie ou nom). */
export async function findInCity(city: string, terms: string[], limit: number) {
  const words = [...new Set(terms.flatMap((t) => norm(t).split(" ")).filter((w) => w.length > 3))].slice(0, 12);
  if (!city || !words.length || limit <= 0) return [];
  // Racine des mots (« pharmacies » → « pharmaci ») pour attraper singulier et pluriel
  const likes = words.map((w) => `%${w.replace(/(es|s|x)$/, "")}%`);
  const unaccent = (col: typeof schema.entities.category | typeof schema.entities.name) =>
    sql`translate(lower(coalesce(${col}, '')), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc')`;
  return db
    .select()
    .from(e)
    .where(
      and(
        isPlace,
        sql`translate(lower(${schema.entities.city}), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') = ${norm(city)}`,
        or(...likes.flatMap((l) => [sql`${unaccent(schema.entities.category)} like ${l}`, sql`${unaccent(schema.entities.name)} like ${l}`])),
      ),
    )
    .orderBy(sql`${schema.entities.confirmations} desc`)
    .limit(limit);
}

/** Établissements connus, retrouvés par leur nom exact dans une ville (enrichissement d'un fichier). */
export async function findByNames(city: string, names: string[]) {
  const keys = [...new Set(names.map((n) => kbKey(n, city)))];
  const found = new Map<string, typeof schema.entities.$inferSelect>();
  for (let i = 0; i < keys.length; i += 500) {
    for (const x of await db.select().from(e).where(and(isPlace, inArray(e.key, keys.slice(i, i + 500))))) found.set(x.key, x);
  }
  return found;
}

/** Recherche dans toute la base (console d'administration), avec le nombre de liens de chaque fiche. */
export async function kbSearch(q: string, limit = 50, type?: EntityType) {
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  return db
    .select({
      entity: e,
      // Nom de table écrit en toutes lettres : dans une sous-requête, Drizzle omettrait le préfixe de la colonne id
      links: sql<number>`(select count(*) from entity_links l where l.from_id = kb_entities.id or l.to_id = kb_entities.id)`.mapWith(Number),
    })
    .from(e)
    .where(and(type ? eq(e.type, type) : undefined, q ? or(ilike(e.name, like), ilike(e.city, like), ilike(e.category, like)) : undefined))
    .orderBy(sql`${e.updatedAt} desc`)
    .limit(limit);
}

export type EntityInput = {
  type: EntityType;
  name: string;
  city?: string | null;
  category?: string | null;
  fields: Record<string, string | number | null | undefined>;
  url?: string | null;
};

/**
 * Ajoute ou complète une fiche de n'importe quel type et renvoie son identifiant (null si elle est invalide).
 * Les champs hors de la liste de son type sont ignorés : une personne ne reçoit jamais de coordonnées.
 */
export async function upsertEntity(input: EntityInput, src: string): Promise<string | null> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 300);
  const city = input.city?.trim() ? cityName(input.city) : null;
  if (name.length < 2 || (input.type === "lieu" && !city)) return null;
  const now = new Date().toISOString();
  const incoming: Record<string, KbValue> = {};
  for (const [f, v] of Object.entries(input.fields)) {
    if (!acceptsField(input.type, f) || v === undefined || v === null || String(v).trim() === "") continue;
    incoming[f] = { v: typeof v === "number" ? v : String(v).trim().slice(0, 2000), n: 1, at: now, src, url: input.url ?? null };
  }
  const key = entityKey(input.type, name, { city, fields: input.fields });
  const [old] = await db.select().from(e).where(and(eq(e.type, input.type), eq(e.key, key)));
  if (!old) {
    const [created] = await db
      .insert(e)
      .values({ type: input.type, key, name, city, category: input.category ?? null, fields: incoming })
      .onConflictDoNothing()
      .returning({ id: e.id });
    if (created) return created.id;
    // Créée entre-temps par une autre exécution : on la complète
    return upsertEntity(input, src);
  }
  await db
    .update(e)
    .set({ fields: mergeFields(old.fields, incoming, now), confirmations: old.confirmations + 1, category: old.category ?? input.category ?? null, city: old.city ?? city, updatedAt: new Date() })
    .where(eq(e.id, old.id));
  return old.id;
}

/** Relie deux fiches (une personne auteur d'une publication…) ; un lien déjà connu est confirmé une fois de plus. */
export async function linkEntities(fromId: string, relation: Relation, toId: string, src: string) {
  if (fromId === toId) return;
  const l = schema.entityLinks;
  await db
    .insert(l)
    .values({ fromId, relation, toId, src })
    .onConflictDoUpdate({
      target: [l.fromId, l.relation, l.toId],
      set: { confirmations: sql`${l.confirmations} + 1`, updatedAt: new Date() },
    });
}
