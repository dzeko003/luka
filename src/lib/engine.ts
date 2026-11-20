import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { ColumnDef, LogEntry } from "@/db/schema";
import { apify, tavilyKey, tierLimits } from "./config";
import { apifyAvailable, facebookPages, instagramProfiles, instagramUsername, searchGoogleMaps } from "./connectors/apify";
import { OSM_ATTRIBUTION, searchOsmPlaces, type OsmFilter } from "./connectors/osm";
import { PLACE_FIELDS, placeFieldOf, type Place, type PlaceField } from "./connectors/places";
import { reverseGeocode } from "./connectors/reverse";
import { tavilyConnector } from "./connectors/tavily";
import { readWebsiteContacts, type WebsiteContacts } from "./connectors/website";
import type { SourceDocument } from "./connectors/types";
import { chatJson } from "./llm";
import { collecteMail, sendMail } from "./mailer";
import { notify } from "./notifications";

export type Value = string | number | boolean | null;
export type ExtractedRow = {
  data: Record<string, Value>;
  /** Liens vers les réseaux sociaux, gardés même sans colonne dédiée (pour l'enrichissement). */
  links?: { facebook?: string; instagram?: string };
  /** Coordonnées GPS, gardées même sans colonne dédiée (pour retrouver arrondissement et quartier). */
  coords?: { lat: number; lon: number };
  sourceUrl: string | null;
  sourceTitle: string | null;
  confidence: number;
};

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export function describeColumns(columns: ColumnDef[]) {
  return columns
    .map((c) => `- "${c.name}" (${c.type}) : ${c.label}${c.description ? ` — ${c.description}` : ""}`)
    .join("\n");
}

async function planQueries(c: CollecteRecord, max: number) {
  const { data } = await chatJson<{ queries?: string[] }>(
    [
      {
        role: "system",
        content:
          "Tu prépares des recherches web pour collecter des données. Réponds uniquement en JSON : " +
          '{"queries": ["…"]}. Les requêtes doivent être courtes, précises, variées, et rédigées dans la ' +
          "langue la plus susceptible de donner de bons résultats (souvent le français pour l'Afrique francophone).",
      },
      {
        role: "user",
        content: `Demande : ${c.request}\n\nColonnes à remplir :\n${describeColumns(c.columns)}\n\nDonne au maximum ${max} requêtes.`,
      },
    ],
    { userId: c.userId, collecteId: c.id, purpose: "plan" },
    { maxTokens: 2000 },
  );
  const queries = (data.queries ?? []).filter((q) => typeof q === "string" && q.trim()).slice(0, max);
  return queries.length ? queries : [c.request.slice(0, 200)];
}

/* ------------------------------------------------------------------ */
/* Lieux : Google Maps (Premium), OpenStreetMap, réseaux sociaux       */
/* ------------------------------------------------------------------ */

export type PlacesPlan = {
  zones: string[];
  filters: OsmFilter[];
  /** Recherches à taper dans Google Maps (« restaurant », « hôtel »…) */
  searches: string[];
  mapping: Record<string, PlaceField>;
};

/** L'IA décide si la demande porte sur des lieux et la traduit pour les sources cartographiques. */
async function planPlaces(c: CollecteRecord): Promise<PlacesPlan | null> {
  const { data } = await chatJson<{
    lieux?: boolean;
    zones?: unknown[];
    filtres?: { cle?: string; valeurs?: unknown[] }[];
    recherches?: unknown[];
    colonnes?: Record<string, unknown>;
  }>(
    [
      {
        role: "system",
        content:
          "Tu prépares une recherche de lieux sur des cartes (OpenStreetMap et Google Maps). Réponds uniquement en JSON :\n" +
          '{"lieux": true|false, "zones": ["Ville, Pays"], "filtres": [{"cle": "amenity", "valeurs": ["restaurant"]}], ' +
          '"recherches": ["restaurant"], "colonnes": {"<nom_colonne>": "<champ>"}}\n' +
          "- lieux = true seulement si la demande porte sur des lieux physiques qu'on trouve sur une carte " +
          "(établissements, commerces, services, équipements, bâtiments publics…).\n" +
          "- zones : les villes, régions ou pays concernés, avec le pays (ex. « Brazzaville, République du Congo »).\n" +
          "- filtres : clés et valeurs de tags OpenStreetMap standards (amenity, tourism, shop, leisure, office, " +
          "healthcare, craft…), en minuscules, avec toutes les valeurs utiles (ex. bar, pub, nightclub pour les bars).\n" +
          "- recherches : les termes courts qu'une personne taperait dans Google Maps, un par type de lieu, " +
          "dans la langue du pays (ex. « restaurant », « hôtel », « boîte de nuit »), sans le nom de la ville.\n" +
          `- colonnes : pour chaque colonne qu'une fiche de lieu peut remplir, le champ parmi : ${PLACE_FIELDS.join(", ")}. ` +
          "« note » et « nombre_avis » sont ceux de Google ; « *_abonnes » sont les abonnés des réseaux sociaux ; " +
          "« arrondissement » est la division administrative de la ville ; « autre_contact » un second numéro ou un email ; " +
          "« remarques » une description ou les services du lieu ; « lien_carte » le lien vers la fiche sur la carte ; " +
          "« photo » le lien de la photo principale ; « niveau_prix » petit budget, moyen ou haut de gamme. " +
          "N'inclus pas les colonnes qu'aucun de ces champs ne couvre.",
      },
      { role: "user", content: `Demande : ${c.request}\n\nColonnes :\n${describeColumns(c.columns)}` },
    ],
    { userId: c.userId, collecteId: c.id, purpose: "plan" },
    { maxTokens: 1500 },
  );
  if (!data.lieux) return null;
  const zones = (data.zones ?? []).filter((z): z is string => typeof z === "string" && z.trim().length > 1);
  const filters = (data.filtres ?? [])
    .map((f) => ({
      key: String(f.cle ?? "").trim().toLowerCase(),
      values: (f.valeurs ?? []).map((v) => String(v).trim().toLowerCase()),
    }))
    .filter((f) => f.key && f.values.length);
  const searches = (data.recherches ?? []).filter((q): q is string => typeof q === "string" && q.trim().length > 1).map((q) => q.trim());
  const mapping: Record<string, PlaceField> = {};
  for (const col of c.columns) {
    // Champ choisi à la création de la collecte (suggestion ou modèle) : prioritaire sur l'avis de l'IA
    const fixed = placeFieldOf(col);
    if (fixed) {
      mapping[col.name] = fixed;
      continue;
    }
    const field = data.colonnes?.[col.name];
    if (typeof field === "string" && (PLACE_FIELDS as readonly string[]).includes(field)) mapping[col.name] = field as PlaceField;
  }
  // La première colonne identifie la ligne : sans elle, les fiches seraient inutilisables
  if (!mapping[c.columns[0].name]) mapping[c.columns[0].name] = "nom";
  return zones.length && (filters.length || searches.length) ? { zones, filters, searches, mapping } : null;
}

function placeToRow(c: CollecteRecord, plan: PlacesPlan, p: Place, sourceTitle: string, confidence: number): ExtractedRow {
  const data: Record<string, Value> = {};
  for (const col of c.columns) {
    const field = plan.mapping[col.name];
    data[col.name] = field ? normalizeValue(p.fields[field], col.type) : null;
  }
  const links = { facebook: p.fields.facebook as string | undefined, instagram: p.fields.instagram as string | undefined };
  const lat = Number(p.fields.latitude);
  const lon = Number(p.fields.longitude);
  const coords = Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) ? { lat, lon } : undefined;
  return { data, links, coords, sourceUrl: p.url || null, sourceTitle, confidence };
}

/** Arrondissement, quartier et rue retrouvés à partir des coordonnées GPS (gratuit, 1 lieu par seconde). */
async function enrichFromCoordinates(c: CollecteRecord, plan: PlacesPlan, rows: ExtractedRow[]) {
  const isEmpty = (v: Value) => v === null || v === "";
  const cols = c.columns.filter((col) => ["arrondissement", "quartier", "rue", "adresse"].includes(plan.mapping[col.name]));
  // L'adresse seule ne justifie pas l'étape : on ne la complète que si l'arrondissement ou le quartier sont demandés
  if (!cols.some((col) => plan.mapping[col.name] !== "adresse")) return;
  const todo = rows.filter((r) => r.coords && cols.some((col) => isEmpty(r.data[col.name])));
  const batch = todo.slice(0, tierLimits(c.tier).maxReverseGeocode);
  if (!batch.length) return;
  await addLog(c.id, `Arrondissements et quartiers : ${batch.length} lieu(x) situé(s) d'après leurs coordonnées (environ ${Math.ceil(batch.length / 55)} min)…`);
  let n = 0;
  for (const [i, r] of batch.entries()) {
    const a = await reverseGeocode(r.coords!.lat, r.coords!.lon);
    if (a) {
      let changed = false;
      for (const col of cols) {
        const field = plan.mapping[col.name];
        const v = field === "adresse" ? [a.rue, a.quartier].filter(Boolean).join(", ") : a[field as "arrondissement" | "quartier" | "rue"];
        if (v && isEmpty(r.data[col.name])) {
          r.data[col.name] = v;
          changed = true;
        }
      }
      if (changed) n++;
    }
    if (i % 50 === 49) await setProgress(c.id, 85 + (5 * i) / batch.length);
  }
  await addLog(c.id, `Arrondissements et quartiers : ${n} ligne(s) complétée(s).`);
}

/** Budget Apify d'une collecte : chaque robot reçoit ce qui reste, Apify l'arrête au-delà. */
export class Budget {
  spent = 0;
  constructor(readonly max: number) {}
  get left() {
    return Math.max(0, this.max - this.spent);
  }
}

const usd = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $`;

/** Google Maps (Premium) puis OpenStreetMap pour compléter. */
async function collectPlaces(c: CollecteRecord, plan: PlacesPlan, found: RowSet, budget: Budget | null) {
  const log = (m: string, level?: LogEntry["level"]) => addLog(c.id, m, level);
  const wantsContacts = Object.values(plan.mapping).some((f) =>
    ["email", "facebook", "instagram", "tiktok", "linkedin", "x", "youtube", "instagram_abonnes", "facebook_abonnes"].includes(f),
  );

  if (budget && plan.searches.length) {
    const zones = plan.zones.slice(0, 5);
    for (const [i, zone] of zones.entries()) {
      const wanted = Math.ceil((c.maxRows - found.size) / (zones.length - i));
      // Une part du budget est gardée pour les réseaux sociaux
      const share = budget.left * (wantsContacts ? 0.75 : 1) / (zones.length - i);
      if (wanted <= 0 || share < 0.5) break;
      await log(`Google Maps : ${plan.searches.join(", ")} à ${zone} (jusqu'à ${wanted} lieux, ${usd(share)} max)…`);
      try {
        const { places, costUsd, status } = await searchGoogleMaps(zone, plan.searches, {
          maxPlaces: wanted,
          maxUsd: share,
          contacts: wantsContacts,
          onProgress: (m) => log(`Google Maps : ${m}`),
        });
        budget.spent += costUsd;
        found.add(places.map((p) => placeToRow(c, plan, p, "Google Maps (via Apify)", 0.9)));
        await log(
          `Google Maps : ${places.length} lieu(x) à ${zone}, coût ${usd(costUsd)}` + (status === "SUCCEEDED" ? "." : ` (arrêt : ${status.toLowerCase()}).`),
        );
      } catch (e) {
        await log(`Google Maps ignoré : ${(e as Error).message}`, "warn");
      }
      await setProgress(c.id, 10 + (30 * (i + 1)) / zones.length);
    }
  }

  // OpenStreetMap : gratuit, complète ce que Google Maps n'a pas donné
  if (found.size < c.maxRows && plan.filters.length) {
    try {
      const places = await searchOsmPlaces(plan.zones, plan.filters, c.maxRows - found.size, (m, level) => log(m, level));
      found.add(places.map((p) => placeToRow(c, plan, p, OSM_ATTRIBUTION, 0.8)));
    } catch (e) {
      await log(`OpenStreetMap ignoré : ${(e as Error).message}`, "warn");
    }
  }
  await setProgress(c.id, 45);
}

/** Premium : complète les lignes avec les pages Facebook et les comptes Instagram publics des établissements. */
export async function enrichFromSocial(c: CollecteRecord, plan: PlacesPlan, rows: ExtractedRow[], budget: Budget) {
  const colsFor = (...fields: PlaceField[]) => c.columns.filter((col) => fields.includes(plan.mapping[col.name]));
  const isEmpty = (v: Value) => v === null || v === "";
  const fillable = colsFor("email", "telephone", "site_web", "description", "adresse", "categorie");
  const igFollowers = colsFor("instagram_abonnes");
  const fbFollowers = colsFor("facebook_abonnes");

  const fill = (row: ExtractedRow, profile: { [k: string]: string | number | undefined }, followerCols: ColumnDef[]) => {
    let changed = false;
    for (const col of followerCols)
      if (isEmpty(row.data[col.name]) && profile.followers !== undefined) {
        row.data[col.name] = normalizeValue(profile.followers, col.type);
        changed = true;
      }
    for (const col of fillable) {
      const v = profile[plan.mapping[col.name]];
      if (isEmpty(row.data[col.name]) && v) {
        row.data[col.name] = normalizeValue(v, col.type);
        changed = true;
      }
    }
    return changed;
  };
  const needs = (row: ExtractedRow, followerCols: ColumnDef[]) =>
    [...followerCols, ...fillable].some((col) => isEmpty(row.data[col.name]));

  // Instagram : 0,0026 $ par profil environ
  const igRows = igFollowers.length || fillable.length ? rows.filter((r) => r.links?.instagram && needs(r, igFollowers)) : [];
  const igTargets = new Map<string, ExtractedRow[]>();
  for (const r of igRows) {
    const u = instagramUsername(r.links!.instagram!);
    if (u) igTargets.set(u, [...(igTargets.get(u) ?? []), r]);
  }
  const igBudget = budget.left * (igFollowers.length ? 0.4 : 0.25);
  const igNames = [...igTargets.keys()].slice(0, Math.floor(igBudget / 0.003));
  if (igNames.length) {
    await addLog(c.id, `Instagram : lecture de ${igNames.length} compte(s) public(s)…`);
    try {
      const { profiles, costUsd } = await instagramProfiles(igNames, igBudget);
      budget.spent += costUsd;
      let n = 0;
      for (const [name, p] of profiles) for (const r of igTargets.get(name) ?? []) if (fill(r, p, igFollowers)) n++;
      await addLog(c.id, `Instagram : ${n} ligne(s) complétée(s), coût ${usd(costUsd)}.`);
    } catch (e) {
      await addLog(c.id, `Instagram ignoré : ${(e as Error).message}`, "warn");
    }
  }
  await setProgress(c.id, 92);

  // Facebook : environ 0,012 $ par page
  const fbRows = rows.filter((r) => r.links?.facebook && needs(r, fbFollowers));
  const fbBudget = budget.left;
  const fbUrls = [...new Set(fbRows.map((r) => r.links!.facebook!))].slice(0, Math.floor(fbBudget / 0.013));
  if (fbUrls.length && (fbFollowers.length || fillable.length)) {
    await addLog(c.id, `Facebook : lecture de ${fbUrls.length} page(s) publique(s)…`);
    try {
      const { pages, costUsd, key } = await facebookPages(fbUrls, fbBudget);
      budget.spent += costUsd;
      let n = 0;
      for (const r of fbRows) {
        const p = pages.get(key(r.links!.facebook!));
        if (p && fill(r, p, fbFollowers)) n++;
      }
      await addLog(c.id, `Facebook : ${n} ligne(s) complétée(s), coût ${usd(costUsd)}.`);
    } catch (e) {
      await addLog(c.id, `Facebook ignoré : ${(e as Error).message}`, "warn");
    }
  }
}

/* ------------------------------------------------------------------ */
/* Compléter les lignes avec les sites web des établissements         */
/* ------------------------------------------------------------------ */

type ContactKind = Exclude<keyof WebsiteContacts, "pageUrl"> | "site_web";

/** Devine quelle information de contact une colonne attend, d'après son nom et son libellé. */
function contactKind(col: ColumnDef): ContactKind | null {
  const t = fold(`${col.name} ${col.label}`);
  if (/facebook|\bfb\b/.test(t)) return "facebook";
  if (/instagram|\binsta\b/.test(t)) return "instagram";
  if (/tiktok/.test(t)) return "tiktok";
  if (/linkedin/.test(t)) return "linkedin";
  if (/youtube/.test(t)) return "youtube";
  if (/twitter|\bx\b/.test(t)) return "x";
  if (/whatsapp/.test(t)) return "whatsapp";
  if (/e-?mail|courriel|\bmail\b/.test(t)) return "email";
  if (/tel|phone|mobile|portable|numero de contact/.test(t)) return "telephone";
  if (/site|web|url|internet/.test(t)) return "site_web";
  return null;
}

export async function enrichFromWebsites(c: CollecteRecord, rows: ExtractedRow[]) {
  const kinds = new Map(c.columns.map((col) => [col.name, contactKind(col)]));
  const siteCol = c.columns.find((col) => kinds.get(col.name) === "site_web")?.name;
  const wanted = c.columns.filter((col) => {
    const k = kinds.get(col.name);
    return k && k !== "site_web";
  });
  if (!siteCol || !wanted.length) return;

  const isEmpty = (v: Value) => v === null || v === "";

  // Un « site web » qui est en réalité une page Facebook ou Instagram va dans la bonne colonne
  for (const r of rows) {
    const site = r.data[siteCol];
    if (typeof site !== "string") continue;
    const kind = /facebook\.com|fb\.com/i.test(site) ? "facebook" : /instagram\.com/i.test(site) ? "instagram" : null;
    const col = kind && wanted.find((w) => kinds.get(w.name) === kind);
    if (col && isEmpty(r.data[col.name])) r.data[col.name] = site;
  }

  const todo = rows.filter((r) => {
    const site = r.data[siteCol];
    return typeof site === "string" && /\./.test(site) && !/facebook\.com|instagram\.com/i.test(site) && wanted.some((col) => isEmpty(r.data[col.name]));
  });
  const batch = todo.slice(0, tierLimits(c.tier).maxEnrichSites);
  if (!batch.length) return;
  await addLog(c.id, `Lecture de ${batch.length} site(s) web d'établissements (contacts, réseaux sociaux)…`);

  let completed = 0;
  let cursor = 0;
  // 4 sites lus en parallèle au maximum
  const worker = async () => {
    while (cursor < batch.length) {
      const row = batch[cursor++];
      try {
        const contacts = await readWebsiteContacts(String(row.data[siteCol]));
        if (!contacts) continue;
        row.links = { facebook: row.links?.facebook ?? contacts.facebook, instagram: row.links?.instagram ?? contacts.instagram };
        let changed = false;
        for (const col of wanted) {
          const value = contacts[kinds.get(col.name) as keyof WebsiteContacts];
          if (value && isEmpty(row.data[col.name])) {
            row.data[col.name] = value;
            changed = true;
          }
        }
        if (changed) {
          completed++;
          row.sourceTitle = row.sourceTitle ? `${row.sourceTitle} + site web` : "Site web de l'établissement";
          if (!row.sourceUrl) row.sourceUrl = contacts.pageUrl;
        }
      } catch {
        /* site injoignable ou refusé : la ligne reste telle quelle */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, batch.length) }, worker));
  await addLog(c.id, `Sites web : ${completed} ligne(s) complétée(s).`);
}

type RawRow = { values?: Record<string, unknown>; source?: number | null; confiance?: number };

async function extractRows(c: CollecteRecord, docs: SourceDocument[], remaining: number): Promise<ExtractedRow[]> {
  const fromKnowledge = docs.length === 0;
  const system = fromKnowledge
    ? "Tu es un assistant de collecte de données. Aucune source web n'est disponible : réponds avec tes " +
      "connaissances, mais n'invente jamais. Si tu n'es pas sûr d'une valeur, mets null. Indique une " +
      "confiance (0 à 1) honnête par ligne : tes connaissances peuvent être anciennes."
    : "Tu es un extracteur de données. Tu dois extraire UNIQUEMENT les informations présentes dans les " +
      "documents fournis. N'invente jamais rien : si une valeur n'apparaît pas dans les documents, mets null. " +
      "Garde une ligne même si certaines colonnes restent inconnues : une ligne partielle vaut mieux " +
      "qu'aucune ligne (seule la première colonne est indispensable). Les documents sont des extraits " +
      "de pages web, parfois désordonnés (tableaux aplatis, menus) : lis-les attentivement. " +
      "Pour chaque ligne, indique le numéro du document source et une confiance (0 à 1).";

  const docsText = docs.map((d, i) => `### Document [${i + 1}] — ${d.title}\nURL : ${d.url}\n${d.content}`).join("\n\n");

  const { data } = await chatJson<{ rows?: RawRow[] }>(
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Demande : ${c.request}\n\nColonnes (clés JSON à utiliser) :\n${describeColumns(c.columns)}\n\n` +
          `Renvoie au maximum ${remaining} lignes au format JSON :\n` +
          `{"rows": [{"values": {${c.columns.map((col) => `"${col.name}": …`).join(", ")}}, ` +
          `"source": ${fromKnowledge ? "null" : "<numéro du document>"}, "confiance": 0.0}]}\n` +
          `Si rien ne correspond, renvoie {"rows": []}.` +
          (fromKnowledge ? "" : `\n\n${docsText}`),
      },
    ],
    { userId: c.userId, collecteId: c.id, purpose: "extract" },
    { maxTokens: 8000 },
  );

  return (data.rows ?? [])
    .filter((r) => r && typeof r.values === "object" && r.values)
    .map((r) => {
      const doc = typeof r.source === "number" ? docs[r.source - 1] : undefined;
      const values: Record<string, Value> = {};
      for (const col of c.columns) values[col.name] = normalizeValue(r.values![col.name], col.type);
      const conf = typeof r.confiance === "number" ? Math.max(0, Math.min(1, r.confiance)) : 0.5;
      return {
        data: values,
        sourceUrl: doc?.url ?? null,
        sourceTitle: doc?.title ?? (fromKnowledge ? "Connaissances du modèle (à vérifier)" : null),
        // Sans source vérifiable, la confiance est plafonnée
        confidence: doc ? conf : Math.min(conf, 0.4),
      };
    })
    .filter((r) => Object.values(r.data).some((v) => v !== null && v !== ""));
}

/* ------------------------------------------------------------------ */
/* Sélection des passages pertinents                                   */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  "avec dans pour leur leurs sont cette ceux celles quels quelles liste les des une aux par sur plus tous toutes actuel actuelle nom noms".split(" "),
);

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function keywordsOf(c: CollecteRecord) {
  const text = fold([c.request, ...c.columns.map((col) => `${col.label} ${col.description ?? ""}`)].join(" "));
  return [...new Set(text.match(/[a-z0-9]{4,}/g) ?? [])].filter((w) => !STOP.has(w));
}

/**
 * Une page peut être longue : on la découpe en passages et on garde les plus pertinents
 * (mots de la demande et des colonnes), dans leur ordre d'origine, jusqu'à `budget` caractères.
 */
export function selectPassages(content: string, keywords: string[], budget: number) {
  if (content.length <= budget) return content;
  const size = 1200;
  const chunks: { i: number; text: string; score: number }[] = [];
  for (let i = 0; i * size < content.length; i++) {
    const text = content.slice(i * size, (i + 1) * size);
    const folded = fold(text);
    let score = 0;
    for (const k of keywords) {
      const n = folded.split(k).length - 1;
      if (n) score += 1 + Math.min(n, 5) * 0.2; // diversité des mots > répétition
    }
    // Les listes et tableaux (beaucoup de séparateurs) contiennent souvent les données cherchées
    score += Math.min((text.match(/[|•\n]/g) ?? []).length / 40, 1);
    chunks.push({ i, text, score });
  }
  const kept = [...chunks]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.floor(budget / size)))
    .sort((a, b) => a.i - b.i);
  return kept.map((ch, j) => (j > 0 && kept[j - 1].i !== ch.i - 1 ? "[…] " : "") + ch.text).join(" ");
}

/* ------------------------------------------------------------------ */
/* Normalisation et dédoublonnage                                      */
/* ------------------------------------------------------------------ */

export function normalizeValue(v: unknown, type: ColumnDef["type"]): Value {
  if (v === undefined || v === null) return null;
  if (typeof v === "object") v = JSON.stringify(v);
  const s = String(v).trim();
  if (!s || /^(null|n\/a|inconnu|non (trouvé|disponible))$/i.test(s)) return null;
  switch (type) {
    case "nombre": {
      if (typeof v === "number") return v;
      const n = Number(s.replace(/[\s  ]/g, "").replace(",", ".").replace(/[^\d.+-]/g, ""));
      return Number.isFinite(n) && /\d/.test(s) ? n : s;
    }
    case "booleen":
      if (typeof v === "boolean") return v;
      if (/^(oui|yes|true|vrai)$/i.test(s)) return true;
      if (/^(non|no|false|faux)$/i.test(s)) return false;
      return s;
    default:
      return s;
  }
}

export const keyOf = (v: Value) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Lignes trouvées, indexées par la 1re colonne (et la ville si elle existe) : les doublons
 * sont fusionnés en complétant les champs vides. L'index évite de comparer chaque ligne à
 * toutes les autres, indispensable au-delà de quelques milliers de lignes.
 */
class RowSet {
  readonly rows: ExtractedRow[] = [];
  private index = new Map<string, ExtractedRow>();
  constructor(
    private firstCol: string,
    private cityCol: string | undefined,
  ) {}

  get size() {
    return this.rows.length;
  }

  private key(row: ExtractedRow) {
    const k = keyOf(row.data[this.firstCol]);
    if (!k) return "";
    // Deux « Hôtel Olympic » dans deux villes différentes sont deux lignes distinctes
    const city = this.cityCol ? keyOf(row.data[this.cityCol]) : "";
    return city ? `${k}|${city}` : k;
  }

  add(incoming: ExtractedRow[]) {
    for (const row of incoming) {
      const k = this.key(row);
      // Une ligne sans ville peut compléter une ligne du même nom déjà connue
      const dup = k ? (this.index.get(k) ?? (k.includes("|") ? undefined : this.index.get(this.nameOnly(k)))) : undefined;
      if (!dup) {
        this.rows.push(row);
        if (k) {
          this.index.set(k, row);
          if (!this.index.has(this.nameOnly(k))) this.index.set(this.nameOnly(k), row);
        }
        continue;
      }
      mergeInto(dup, row);
    }
  }

  private nameOnly(k: string) {
    return `${k.split("|")[0]}|*`;
  }
}

function mergeInto(dup: ExtractedRow, row: ExtractedRow) {
  for (const [col, val] of Object.entries(row.data)) {
    if ((dup.data[col] === null || dup.data[col] === "") && val !== null) dup.data[col] = val;
  }
  if (!dup.coords && row.coords) dup.coords = row.coords;
  if (row.links) dup.links = { facebook: dup.links?.facebook ?? row.links.facebook, instagram: dup.links?.instagram ?? row.links.instagram };
  if (!dup.sourceUrl && row.sourceUrl) {
    dup.sourceUrl = row.sourceUrl;
    dup.sourceTitle = row.sourceTitle;
  }
  dup.confidence = Math.max(dup.confidence, row.confidence);
}

/* ------------------------------------------------------------------ */
/* Exécution                                                           */
/* ------------------------------------------------------------------ */

export type CollecteRecord = typeof schema.collectes.$inferSelect;

/** Au-delà de cette durée (file d'attente comprise), l'utilisateur a sans doute quitté la page : on le prévient par e-mail. */
const MAIL_AFTER_MS = 2 * 60_000;

/** E-mail de fin de collecte ; une erreur d'envoi n'affecte jamais la collecte. */
export async function mailCollecteEnd(c: CollecteRecord, outcome: { rows?: number; error?: string }) {
  if (Date.now() - c.createdAt.getTime() < MAIL_AFTER_MS) return;
  try {
    const [u] = await db
      .select({ email: schema.user.email, name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.id, c.userId));
    if (!u) return;
    const base = (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
    await sendMail({ to: u.email, ...collecteMail(u.name, `${base}/collectes/${c.id}`, { title: c.title, ...outcome }) });
  } catch (e) {
    console.error(`[mail] échec de l'e-mail de fin de collecte : ${(e as Error).message}`);
  }
}

export async function addLog(id: string, message: string, level: LogEntry["level"] = "info") {
  const entry: LogEntry = { at: new Date().toISOString(), message, level };
  await db
    .update(schema.collectes)
    .set({ log: sql`${schema.collectes.log} || ${JSON.stringify([entry])}::jsonb`, heartbeatAt: new Date() })
    .where(eq(schema.collectes.id, id));
}

/** Avancement affiché à l'utilisateur (0 → 100). */
export async function setProgress(id: string, pct: number) {
  await db
    .update(schema.collectes)
    .set({ progress: Math.max(0, Math.min(100, Math.round(pct))), heartbeatAt: new Date() })
    .where(eq(schema.collectes.id, id));
}

/** Enregistre les lignes par paquets (une requête unique dépasserait la limite de PostgreSQL). */
export async function saveRows(collecteId: string, rows: ExtractedRow[]) {
  for (let i = 0; i < rows.length; i += 1000) {
    await db.insert(schema.rows).values(
      rows.slice(i, i + 1000).map((r, j) => ({
        collecteId,
        data: r.data,
        sourceUrl: r.sourceUrl,
        sourceTitle: r.sourceTitle,
        confidence: r.confidence,
        position: i + j,
      })),
    );
  }
}

/** Exécute une collecte déjà réservée par la file d'attente (statut « running »), voir worker.ts. */
export async function runCollecte(collecteId: string) {
  const [c] = await db.select().from(schema.collectes).where(eq(schema.collectes.id, collecteId));
  if (!c || c.status !== "running") return;
  // Enrichissement d'un fichier importé : autre déroulé, mêmes sources (import tardif : évite une dépendance circulaire)
  if (c.kind === "enrichissement") return (await import("./enrich")).runEnrichment(c);

  const cfg = tierLimits(c.tier);
  const firstCol = c.columns[0].name;
  const cityCol = c.columns.find((col, i) => i > 0 && /^(ville|city|commune|localite)$/.test(fold(col.name)))?.name;
  const found = new RowSet(firstCol, cityCol);
  // Sources payantes : uniquement pour les collectes Premium, avec un plafond de dépense
  const budget = c.tier === "premium" && apifyAvailable() ? new Budget(apify.maxUsdPerCollecte) : null;
  let plan: PlacesPlan | null = null;

  try {
    const docs: SourceDocument[] = [];

    // 1. Lieux : les fiches arrivent déjà structurées (Google Maps en Premium, OpenStreetMap)
    await addLog(c.id, "Analyse de la demande…");
    try {
      plan = await planPlaces(c);
    } catch (e) {
      await addLog(c.id, `Analyse des lieux ignorée : ${(e as Error).message}`, "warn");
    }
    if (c.tier === "premium" && !budget) await addLog(c.id, "Google Maps indisponible (APIFY_TOKEN manquant) : sources gratuites uniquement.", "warn");
    if (plan) await collectPlaces(c, plan, found, budget);
    const fromPlaces = found.size;

    // 2. Recherche web, pour compléter ce que les sources ouvertes n'ont pas donné
    if (found.size >= c.maxRows) {
      await addLog(c.id, `${found.size} ligne(s) déjà trouvée(s) : recherche web non nécessaire.`);
    } else if (fromPlaces >= Math.min(100, c.maxRows * 0.3)) {
      // Les cartes ont déjà donné l'essentiel : la recherche web ajouterait peu de lignes pour beaucoup de temps
      await addLog(c.id, `${fromPlaces} lieu(x) trouvé(s) sur les cartes : recherche web non nécessaire.`);
    } else if (tavilyKey) {
      await addLog(c.id, "Préparation des recherches web…");
      const queries = await planQueries(c, cfg.maxQueries);
      const seen = new Set<string>();
      const keywords = keywordsOf(c);
      for (const q of queries) {
        await addLog(c.id, `Recherche : « ${q} »`);
        try {
          const results = await tavilyConnector.search(q, {
            maxResults: cfg.pagesPerQuery,
            maxChars: 150_000,
          });
          for (const d of results) {
            if (d.url && !seen.has(d.url) && d.content.length > 50) {
              seen.add(d.url);
              docs.push({ ...d, content: selectPassages(d.content, keywords, cfg.charsPerPage) });
            }
          }
        } catch (e) {
          await addLog(c.id, (e as Error).message, "warn");
        }
      }
      await addLog(c.id, `${docs.length} page(s) trouvée(s). Extraction des données…`);
    } else if (found.size === 0) {
      await addLog(c.id, "Aucune clé de recherche web : réponse à partir des connaissances du modèle.", "warn");
    }

    if (docs.length === 0) {
      if (found.size === 0) found.add(await extractRows(c, [], c.maxRows));
    } else {
      // Les pages sont lues 2 par 2 pour rester dans les limites des offres gratuites
      for (let i = 0; i < docs.length && found.size < c.maxRows; i += 2) {
        const batch = docs.slice(i, i + 2);
        try {
          const rowsOut = await extractRows(c, batch, c.maxRows - found.size);
          found.add(rowsOut);
          await setProgress(c.id, 35 + (50 * (i + batch.length)) / docs.length);
          await addLog(c.id, `Pages ${i + 1}–${i + batch.length} : ${rowsOut.length} ligne(s) extraite(s)`);
        } catch (e) {
          await addLog(c.id, `Pages ${i + 1}–${i + batch.length} ignorées : ${(e as Error).message}`, "warn");
        }
      }
    }

    const finalRows = found.rows.slice(0, c.maxRows);
    await setProgress(c.id, 85);

    // 3. Les sites web des établissements complètent contacts et réseaux sociaux
    await enrichFromWebsites(c, finalRows);
    if (plan) await enrichFromCoordinates(c, plan, finalRows);

    // 4. Premium : pages Facebook et comptes Instagram publics des établissements
    if (budget && plan && budget.left >= 0.05) await enrichFromSocial(c, plan, finalRows, budget);
    await saveRows(c.id, finalRows);

    const [usage] = await db
      .select({
        calls: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${schema.llmUsage.promptTokens} + ${schema.llmUsage.completionTokens}), 0)::int`,
      })
      .from(schema.llmUsage)
      .where(eq(schema.llmUsage.collecteId, c.id));

    await addLog(c.id, `Terminé : ${finalRows.length} ligne(s) à vérifier.`);
    await db
      .update(schema.collectes)
      .set({
        status: "done",
        progress: 100,
        finishedAt: new Date(),
        llmCalls: usage.calls,
        tokensUsed: usage.tokens,
        costUsd: budget?.spent ?? 0,
      })
      .where(eq(schema.collectes.id, c.id));
    await notify(c.userId, {
      title: `Collecte terminée : ${c.title}`,
      body: `${finalRows.length} ligne(s) trouvée(s), à vérifier.`,
      href: `/collectes/${c.id}`,
    });
    await mailCollecteEnd(c, { rows: finalRows.length });
  } catch (e) {
    const message = (e as Error).message || "Erreur inconnue";
    await addLog(c.id, message, "error");
    await db
      .update(schema.collectes)
      .set({ status: "failed", error: message, finishedAt: new Date(), costUsd: budget?.spent ?? 0 })
      .where(eq(schema.collectes.id, c.id));
    await notify(c.userId, {
      title: `Échec de la collecte : ${c.title}`,
      body: message,
      href: `/collectes/${c.id}`,
    });
    await mailCollecteEnd(c, { error: message });
  }
}
