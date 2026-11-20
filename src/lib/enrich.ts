import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ColumnDef } from "@/db/schema";
import { apify, tavilyKey, tierLimits } from "./config";
import { apifyAvailable, lookupGoogleMaps } from "./connectors/apify";
import { PLACE_FIELDS, placeFieldOf, type Place, type PlaceField } from "./connectors/places";
import { tavilyConnector } from "./connectors/tavily";
import type { SourceDocument } from "./connectors/types";
import {
  addLog,
  Budget,
  type CollecteRecord,
  describeColumns,
  enrichFromSocial,
  enrichFromWebsites,
  type ExtractedRow,
  fold,
  keyOf,
  mailCollecteEnd,
  normalizeValue,
  type PlacesPlan,
  saveRows,
  selectPassages,
  setProgress,
  type Value,
} from "./engine";
import { chatJson } from "./llm";
import { notify } from "./notifications";

/*
 * Enrichissement d'un fichier importé : les lignes sont celles de l'utilisateur, Luka complète
 * seulement les colonnes ajoutées. Chaque ligne est cherchée par son nom :
 *   1. Google Maps (Premium), une fiche par établissement ;
 *   2. recherche web, puis l'IA lit les pages trouvées pour chaque ligne ;
 *   3. sites web des établissements (contacts) et, en Premium, Facebook et Instagram.
 * Rien n'est inventé : une valeur introuvable reste vide.
 */

const isEmpty = (v: Value) => v === null || v === "";

type Plan = { zone: string | null; mapping: Record<string, PlaceField> };

/** Zone géographique des lignes et correspondance entre les colonnes à ajouter et les champs des fiches de lieux. */
async function planEnrichment(c: CollecteRecord, sample: ExtractedRow[], newCols: ColumnDef[]): Promise<Plan> {
  const mapping: Record<string, PlaceField> = {};
  for (const col of newCols) {
    const f = placeFieldOf(col);
    if (f) mapping[col.name] = f;
  }
  const examples = sample
    .slice(0, 5)
    .map((r) => JSON.stringify(Object.fromEntries(Object.entries(r.data).filter(([, v]) => !isEmpty(v)))))
    .join("\n");
  const { data } = await chatJson<{ zone?: unknown; colonnes?: Record<string, unknown> }>(
    [
      {
        role: "system",
        content:
          "Tu prépares l'enrichissement d'un fichier : chaque ligne décrit une entité (souvent un établissement) et il faut " +
          "compléter des colonnes. Réponds uniquement en JSON : " +
          '{"zone": "Ville, Pays" ou null, "colonnes": {"<nom_colonne>": "<champ>"}}\n' +
          "- zone : la ville ou le pays où se trouvent ces entités, d'après la description et les exemples (avec le pays), " +
          "sinon null.\n" +
          `- colonnes : pour chaque colonne à ajouter qu'une fiche Google Maps peut remplir, le champ parmi : ${PLACE_FIELDS.join(", ")}. ` +
          "N'inclus pas les autres colonnes.",
      },
      {
        role: "user",
        content: `Ce que sont les lignes : ${c.request}\n\nExemples de lignes :\n${examples}\n\nColonnes à ajouter :\n${describeColumns(newCols)}`,
      },
    ],
    { userId: c.userId, collecteId: c.id, purpose: "plan" },
    { maxTokens: 1000 },
  );
  for (const col of newCols) {
    const f = data.colonnes?.[col.name];
    if (!mapping[col.name] && typeof f === "string" && (PLACE_FIELDS as readonly string[]).includes(f)) mapping[col.name] = f as PlaceField;
  }
  const zone = typeof data.zone === "string" && data.zone.trim().length > 1 ? data.zone.trim() : null;
  return { zone, mapping };
}

/** Le nom trouvé correspond-il à celui de la ligne ? (mots en commun, accents et casse ignorés) */
function sameName(a: string, b: string) {
  const ta = new Set(keyOf(a).split(" ").filter((w) => w.length > 1));
  const tb = new Set(keyOf(b).split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return false;
  const common = [...ta].filter((w) => tb.has(w)).length;
  return common / Math.min(ta.size, tb.size) >= 0.6;
}

/** Premium : une recherche Google Maps par établissement, par paquets de 50. */
async function fromGoogleMaps(c: CollecteRecord, rows: ExtractedRow[], keyCol: string, newCols: ColumnDef[], plan: Plan, budget: Budget) {
  const cols = newCols.filter((col) => plan.mapping[col.name]);
  const todo = rows.filter((r) => typeof r.data[keyCol] === "string" && cols.some((col) => isEmpty(r.data[col.name])));
  if (!todo.length || !plan.zone) return;
  const names = [...new Set(todo.map((r) => String(r.data[keyCol]).trim()))];
  await addLog(c.id, `Google Maps : recherche de ${names.length} établissement(s) à ${plan.zone}…`);
  let completed = 0;
  // Une part du budget reste pour Facebook et Instagram
  const share = budget.left * 0.75;
  for (let i = 0; i < names.length; i += 50) {
    const batch = names.slice(i, i + 50);
    const maxUsd = Math.min(budget.left, share - budget.spent);
    if (maxUsd < 0.2) {
      await addLog(c.id, "Google Maps : budget de la collecte atteint, la suite passe par la recherche web.", "warn");
      break;
    }
    try {
      const { found, costUsd } = await lookupGoogleMaps(plan.zone, batch, { maxUsd, contacts: true });
      budget.spent += costUsd;
      for (const r of todo) {
        const name = String(r.data[keyCol]).trim();
        const place: Place | undefined = found.get(name);
        if (!place || !sameName(String(place.fields.nom ?? ""), name)) continue;
        if (fillFromPlace(r, place, cols, plan)) completed++;
      }
    } catch (e) {
      await addLog(c.id, `Google Maps ignoré : ${(e as Error).message}`, "warn");
      break;
    }
    await setProgress(c.id, 10 + (30 * Math.min(names.length, i + 50)) / names.length);
  }
  await addLog(c.id, `Google Maps : ${completed} ligne(s) complétée(s).`);
}

function fillFromPlace(r: ExtractedRow, p: Place, cols: ColumnDef[], plan: Plan) {
  let changed = false;
  for (const col of cols) {
    const v = p.fields[plan.mapping[col.name]];
    if (isEmpty(r.data[col.name]) && v !== undefined && v !== "") {
      r.data[col.name] = normalizeValue(v, col.type);
      changed = true;
    }
  }
  r.links = {
    facebook: r.links?.facebook ?? (p.fields.facebook as string | undefined),
    instagram: r.links?.instagram ?? (p.fields.instagram as string | undefined),
  };
  if (changed) {
    r.sourceUrl = p.url || r.sourceUrl;
    r.sourceTitle = "Google Maps (via Apify)";
    r.confidence = Math.max(r.confidence, 0.85);
  }
  return changed;
}

/** Ce qui identifie la ligne dans une recherche : son nom, puis quelques valeurs courtes du fichier. */
function identity(r: ExtractedRow, keyCol: string, fileCols: ColumnDef[]) {
  const extra = fileCols
    .filter((col) => col.name !== keyCol)
    .map((col) => r.data[col.name])
    .filter((v): v is string | number => !isEmpty(v as Value) && String(v).length <= 40)
    .slice(0, 2);
  return [String(r.data[keyCol]), ...extra].join(", ");
}

/** Mots trop courants pour identifier un établissement à eux seuls. */
const GENERIC = new Set(
  "hotel hotels residence restaurant bar cafe maison societe entreprise ets etablissement groupe cabinet clinique pharmacie ecole college lycee institut centre center palace grand petit les des the and pour".split(" "),
);

/** La page cite-t-elle l'établissement ? Ses mots distinctifs doivent presque tous y apparaître, et la ville si elle est connue. */
function mentions(text: string, name: string, city: string) {
  const t = ` ${keyOf(text)} `;
  const words = keyOf(name).split(" ").filter((w) => w.length > 2);
  const distinct = words.filter((w) => !GENERIC.has(w));
  const pool = distinct.length ? distinct : words;
  if (!pool.length) return false;
  const found = pool.filter((w) => t.includes(` ${w} `)).length;
  if (found / pool.length < 0.7) return false;
  return !city || t.includes(` ${keyOf(city)} `);
}

type RowDocs = { row: ExtractedRow; id: string; docs: SourceDocument[] };

/** Recherche web : une recherche par ligne (3 en parallèle), puis l'IA lit les pages qui citent l'établissement. */
async function fromWeb(c: CollecteRecord, rows: ExtractedRow[], keyCol: string, fileCols: ColumnDef[], newCols: ColumnDef[], zone: string | null) {
  const todo = rows.filter((r) => !isEmpty(r.data[keyCol]) && newCols.some((col) => isEmpty(r.data[col.name])));
  if (!todo.length) return;
  await addLog(c.id, `Recherche web : ${todo.length} ligne(s) à compléter…`);
  const wanted = fold(newCols.map((col) => `${col.label} ${col.description ?? ""}`).join(" ")).match(/[a-z0-9]{4,}/g) ?? [];
  const city = zone?.split(",")[0].trim() ?? "";

  const searched: RowDocs[] = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      const i = cursor++;
      const row = todo[i];
      const id = `L${i + 1}`;
      // Requête courte « nom ville contact » : les requêtes longues ramènent des pages hors sujet
      const query = [String(row.data[keyCol]), city, "contact"].filter(Boolean).join(" ").slice(0, 200);
      try {
        const results = await tavilyConnector.search(query, { maxResults: 5, maxChars: 60_000 });
        const keywords = [...new Set([...(fold(String(row.data[keyCol])).match(/[a-z0-9]{3,}/g) ?? []), ...wanted])];
        // Seules les pages qui parlent bien de cet établissement sont lues (évite les homonymes d'autres pays)
        const docs = results
          .filter((d) => d.content.length > 50 && mentions(`${d.title} ${d.url} ${d.content}`, String(row.data[keyCol]), city))
          .slice(0, 3)
          .map((d) => ({ ...d, content: selectPassages(d.content, keywords, 3000) }));
        if (docs.length) searched.push({ row, id, docs });
      } catch (e) {
        await addLog(c.id, `Recherche « ${query.slice(0, 60)} » ignorée : ${(e as Error).message}`, "warn");
      }
      if (i % 5 === 4) await setProgress(c.id, 40 + (25 * i) / todo.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, todo.length) }, worker));

  // Une ligne par appel : avec plusieurs lignes à la fois, le modèle en oublie
  let completed = 0;
  for (let i = 0; i < searched.length; i++) {
    const batch = searched.slice(i, i + 1);
    try {
      completed += await extractForRows(c, batch, keyCol, fileCols, newCols);
    } catch (e) {
      await addLog(c.id, `Lecture de pages ignorée : ${(e as Error).message}`, "warn");
    }
    await setProgress(c.id, 65 + (25 * (i + batch.length)) / searched.length);
  }
  await addLog(c.id, `Recherche web : ${completed} ligne(s) complétée(s).`);
}

type RawAnswer = { id?: string; values?: Record<string, unknown>; source?: number | null; confiance?: number };

async function extractForRows(c: CollecteRecord, batch: RowDocs[], keyCol: string, fileCols: ColumnDef[], newCols: ColumnDef[]) {
  const blocks = batch
    .map(
      (b) =>
        `## Ligne ${b.id} : ${identity(b.row, keyCol, fileCols)}\n` +
        b.docs.map((d, j) => `### Document [${j + 1}] — ${d.title}\nURL : ${d.url}\n${d.content}`).join("\n\n"),
    )
    .join("\n\n");
  const { data } = await chatJson<{ lignes?: RawAnswer[] }>(
    [
      {
        role: "system",
        content:
          "Tu complètes des lignes d'un fichier à partir de pages web. Pour chaque ligne, tu ne lis QUE ses propres documents. " +
          "N'invente jamais : si une valeur n'apparaît pas clairement pour CETTE entité (même nom, même lieu), mets null. " +
          "Méfie-toi des homonymes et des annuaires qui listent plusieurs établissements. " +
          "Indique le numéro du document d'où viennent les valeurs et une confiance (0 à 1).",
      },
      {
        role: "user",
        content:
          `Ce que sont les lignes : ${c.request}\n\nColonnes à remplir (clés JSON à utiliser) :\n${describeColumns(newCols)}\n\n` +
          `Réponds au format JSON : {"lignes": [{"id": "L1", "values": {${newCols.map((col) => `"${col.name}": …`).join(", ")}}, ` +
          `"source": <numéro du document>, "confiance": 0.0}]}\n\n${blocks}`,
      },
    ],
    { userId: c.userId, collecteId: c.id, purpose: "enrich" },
    { maxTokens: 4000 },
  );
  let completed = 0;
  for (const a of data.lignes ?? []) {
    const b = batch.find((x) => x.id === a?.id);
    if (!b || !a.values || typeof a.values !== "object") continue;
    let changed = false;
    for (const col of newCols) {
      const v = normalizeValue(a.values[col.name], col.type);
      if (isEmpty(b.row.data[col.name]) && !isEmpty(v)) {
        b.row.data[col.name] = v;
        changed = true;
      }
    }
    if (!changed) continue;
    completed++;
    const doc = typeof a.source === "number" ? b.docs[a.source - 1] : undefined;
    const conf = typeof a.confiance === "number" ? Math.max(0, Math.min(1, a.confiance)) : 0.5;
    if (!b.row.sourceUrl && doc) {
      b.row.sourceUrl = doc.url;
      b.row.sourceTitle = doc.title;
    }
    b.row.confidence = Math.max(b.row.confidence, doc ? conf : Math.min(conf, 0.4));
  }
  return completed;
}

/** Exécute un enrichissement déjà réservé par la file d'attente (appelé par runCollecte). */
export async function runEnrichment(c: CollecteRecord) {
  const cfg = tierLimits(c.tier);
  const keyCol = c.columns[0].name;
  const fileCols = c.columns.filter((col) => col.fromFile);
  const newCols = c.columns.filter((col) => !col.fromFile);
  const all = c.input ?? [];
  const input = all.slice(0, Math.min(c.maxRows, cfg.maxEnrichRows));
  const budget = c.tier === "premium" && apifyAvailable() ? new Budget(apify.maxUsdPerCollecte) : null;

  const rows: ExtractedRow[] = input.map((r) => ({
    data: Object.fromEntries(c.columns.map((col) => [col.name, col.fromFile ? normalizeValue(r[col.name], col.type) : null])),
    sourceUrl: null,
    sourceTitle: null,
    confidence: 0,
  }));

  try {
    await addLog(c.id, `${rows.length} ligne(s) à compléter : ${newCols.map((col) => col.label).join(", ")}.`);
    if (all.length > input.length)
      await addLog(c.id, `Le fichier compte ${all.length} lignes : seules les ${input.length} premières sont complétées avec ta formule.`, "warn");

    const plan = await planEnrichment(c, rows, newCols);
    await addLog(c.id, plan.zone ? `Zone : ${plan.zone}.` : "Zone non précisée : recherche sans lieu.");
    await setProgress(c.id, 8);

    if (budget && Object.keys(plan.mapping).length) await fromGoogleMaps(c, rows, keyCol, newCols, plan, budget);
    else if (c.tier === "premium" && !budget) await addLog(c.id, "Google Maps indisponible (APIFY_TOKEN manquant) : sources gratuites uniquement.", "warn");
    await setProgress(c.id, 40);

    if (tavilyKey) await fromWeb(c, rows, keyCol, fileCols, newCols, plan.zone);
    else await addLog(c.id, "Aucune clé de recherche web : seules les autres sources sont utilisées.", "warn");
    await setProgress(c.id, 90);

    // Sites web des établissements (contacts) puis, en Premium, pages Facebook et comptes Instagram
    await enrichFromWebsites(c, rows);
    const socialPlan: PlacesPlan = { zones: [], filters: [], searches: [], mapping: plan.mapping };
    if (budget && budget.left >= 0.05 && Object.keys(plan.mapping).length) await enrichFromSocial(c, socialPlan, rows, budget);

    for (const r of rows) {
      if (!r.sourceTitle) {
        r.sourceTitle = newCols.some((col) => !isEmpty(r.data[col.name])) ? "Site web de l'établissement" : "Rien trouvé";
        if (r.sourceTitle === "Rien trouvé") r.confidence = 0;
      }
    }
    await saveRows(c.id, rows);

    const filled = rows.filter((r) => newCols.some((col) => !isEmpty(r.data[col.name]))).length;
    const [usage] = await db
      .select({
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${schema.llmUsage.promptTokens} + ${schema.llmUsage.completionTokens}), 0)::int`,
      })
      .from(schema.llmUsage)
      .where(eq(schema.llmUsage.collecteId, c.id));
    await addLog(c.id, `Terminé : ${filled} ligne(s) sur ${rows.length} complétée(s), à vérifier.`);
    await db
      .update(schema.collectes)
      .set({ status: "done", progress: 100, finishedAt: new Date(), llmCalls: usage.calls, tokensUsed: usage.tokens, costUsd: budget?.spent ?? 0 })
      .where(eq(schema.collectes.id, c.id));
    await notify(c.userId, {
      title: `Fichier enrichi : ${c.title}`,
      body: `${filled} ligne(s) sur ${rows.length} complétée(s), à vérifier.`,
      href: `/collectes/${c.id}`,
    });
    await mailCollecteEnd(c, { rows: filled });
  } catch (e) {
    const message = (e as Error).message || "Erreur inconnue";
    await addLog(c.id, message, "error");
    await db
      .update(schema.collectes)
      .set({ status: "failed", error: message, finishedAt: new Date(), costUsd: budget?.spent ?? 0 })
      .where(eq(schema.collectes.id, c.id));
    await notify(c.userId, { title: `Échec de l'enrichissement : ${c.title}`, body: message, href: `/collectes/${c.id}` });
    await mailCollecteEnd(c, { error: message });
  }
}
