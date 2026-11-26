import { openData } from "../config";

/**
 * Publications scientifiques (OpenAlex, données sous licence CC0) : articles, thèses, chapitres, rapports,
 * avec leurs auteurs, leurs institutions et les pays de celles-ci. Une clé gratuite (OPENALEX_API_KEY) donne
 * environ 10 000 requêtes par jour ; sans clé, les recherches sont vite limitées.
 */

export const OPENALEX_ATTRIBUTION = "OpenAlex (licence CC0)";

/** Champs qu'une publication peut remplir dans une collecte. */
export const SCHOLAR_FIELDS = [
  "titre",
  "auteurs",
  "premier_auteur",
  "institutions",
  "pays",
  "date",
  "annee",
  "revue",
  "type_document",
  "discipline",
  "domaine",
  "langue",
  "doi",
  "lien",
  "acces_libre",
  "lien_pdf",
  "citations",
  "resume",
] as const;
export type ScholarField = (typeof SCHOLAR_FIELDS)[number];

export type Institution = { name: string; openalex: string; ror?: string; country?: string };
export type Author = { name: string; openalex: string; orcid?: string; institutions: Institution[] };
export type Work = {
  openalex: string;
  fields: Partial<Record<ScholarField, string | number>>;
  url: string;
  authors: Author[];
};

export type WorkQuery = {
  /** Sous-domaines OpenAlex (identifiants numériques, voir resolveSubfields) : sujet principal de la publication. */
  subfields: string[];
  /** Termes cherchés dans le titre et le résumé (l'un ou l'autre), en anglais et dans la langue locale. */
  keywords: string[];
  /** Pays des institutions des auteurs (codes ISO : CG, CD…). */
  countries: string[];
  from?: string | null;
  to?: string | null;
  sort: "recent" | "cite";
  max: number;
};

type OaInstitution = { id: string; display_name: string; ror?: string | null; country_code?: string | null };
type OaWork = {
  id: string;
  doi: string | null;
  display_name: string | null;
  publication_date: string | null;
  publication_year: number | null;
  type: string | null;
  language: string | null;
  cited_by_count: number;
  abstract_inverted_index: Record<string, number[]> | null;
  primary_location: { landing_page_url?: string | null; pdf_url?: string | null; source?: { display_name?: string | null } | null } | null;
  open_access: { is_oa?: boolean; oa_url?: string | null } | null;
  primary_topic: { subfield?: { display_name?: string }; field?: { display_name?: string } } | null;
  authorships: { author: { id: string; display_name: string; orcid: string | null }; institutions: OaInstitution[] }[];
};

const SELECT =
  "id,doi,display_name,publication_date,publication_year,type,language,cited_by_count,abstract_inverted_index," +
  "primary_location,open_access,primary_topic,authorships";

const TYPES: Record<string, string> = {
  article: "article",
  review: "revue de littérature",
  book: "livre",
  "book-chapter": "chapitre",
  dissertation: "thèse",
  preprint: "prépublication",
  report: "rapport",
  dataset: "jeu de données",
  editorial: "éditorial",
  letter: "lettre",
};

const shortId = (url: string) => url.replace(/^https:\/\/openalex\.org\//, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Une valeur de filtre OpenAlex ne doit contenir ni virgule ni barre verticale (séparateurs). */
const clean = (s: string) => s.replace(/[,|:]/g, " ").replace(/\s+/g, " ").trim();

/** Le résumé est fourni sous forme d'index inversé (mot → positions) : on le remet dans l'ordre. */
function abstractOf(index: Record<string, number[]> | null) {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [w, positions] of Object.entries(index)) for (const p of positions) words[p] = w;
  const text = words.filter(Boolean).join(" ");
  return text.length > 1000 ? `${text.slice(0, 997)}…` : text || undefined;
}

function toWork(w: OaWork, countries: string[]): Work {
  const authors: Author[] = w.authorships.map((a) => ({
    name: a.author.display_name,
    openalex: shortId(a.author.id),
    orcid: a.author.orcid?.replace("https://orcid.org/", "") || undefined,
    institutions: a.institutions.map((i) => ({
      name: i.display_name,
      openalex: shortId(i.id),
      ror: i.ror?.replace("https://ror.org/", "") || undefined,
      country: i.country_code ?? undefined,
    })),
  }));
  // Les institutions des pays demandés d'abord : ce sont elles qui intéressent l'utilisateur
  const insts = [...new Map(authors.flatMap((a) => a.institutions).map((i) => [i.openalex, i])).values()].sort(
    (a, b) => Number(countries.includes(b.country ?? "")) - Number(countries.includes(a.country ?? "")),
  );
  const doi = w.doi?.replace("https://doi.org/", "");
  const url = w.doi ?? w.primary_location?.landing_page_url ?? w.id;
  const fields: Work["fields"] = {
    titre: w.display_name ?? undefined,
    auteurs: authors.map((a) => a.name).join(", ") || undefined,
    premier_auteur: authors[0]?.name,
    institutions: insts.map((i) => i.name).slice(0, 8).join(", ") || undefined,
    pays: [...new Set(insts.map((i) => i.country).filter(Boolean))].join(", ") || undefined,
    date: w.publication_date ?? undefined,
    annee: w.publication_year ?? undefined,
    revue: w.primary_location?.source?.display_name ?? undefined,
    type_document: w.type ? (TYPES[w.type] ?? w.type) : undefined,
    discipline: w.primary_topic?.subfield?.display_name,
    domaine: w.primary_topic?.field?.display_name,
    langue: w.language ?? undefined,
    doi,
    lien: url,
    acces_libre: w.open_access?.is_oa ? "oui" : "non",
    lien_pdf: w.primary_location?.pdf_url ?? w.open_access?.oa_url ?? undefined,
    citations: w.cited_by_count,
    resume: abstractOf(w.abstract_inverted_index),
  };
  return { openalex: shortId(w.id), fields, url, authors };
}

async function get<T>(path: string, params: URLSearchParams): Promise<T> {
  const key = process.env.OPENALEX_API_KEY;
  if (key) params.set("api_key", key);
  const url = `https://api.openalex.org/${path}?${params}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": openData.userAgent }, signal: AbortSignal.timeout(30_000) });
    if (res.ok) return res.json();
    // Trop de requêtes : on attend le délai indiqué une fois, puis on abandonne
    if (res.status === 429 && attempt === 1) {
      const wait = Math.min(60, Number(res.headers.get("retry-after")) || 20);
      await sleep(wait * 1000);
      continue;
    }
    const detail = res.status === 429 ? " (limite atteinte : ajoute une clé OPENALEX_API_KEY)" : "";
    throw new Error(`OpenAlex a répondu ${res.status}${detail}`);
  }
}

type WorksPage = { results: OaWork[]; meta: { count: number; next_cursor: string | null } };

const subfieldCache = new Map<string, { id: string; name: string } | null>();

/** Disciplines en anglais (« geography ») → sous-domaines de la classification OpenAlex (« 3305 Geography, Planning and Development »). */
export async function resolveSubfields(names: string[]): Promise<{ id: string; name: string }[]> {
  const out = new Map<string, string>();
  for (const raw of names.slice(0, 6)) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (!subfieldCache.has(name)) {
      const page = await get<{ results: { id: string; display_name: string }[] }>(
        "subfields",
        new URLSearchParams({ search: clean(name), per_page: "1", select: "id,display_name" }),
      );
      const r = page.results[0];
      subfieldCache.set(name, r ? { id: r.id.split("/").pop()!, name: r.display_name } : null);
    }
    const hit = subfieldCache.get(name);
    if (hit) out.set(hit.id, hit.name);
  }
  return [...out].map(([id, name]) => ({ id, name }));
}

/** Publications correspondant à la recherche, des plus récentes (ou des plus citées) aux plus anciennes. */
export async function searchWorks(q: WorkQuery, onLog?: (m: string) => Promise<unknown> | void): Promise<{ works: Work[]; total: number }> {
  const filters: string[] = [];
  const countries = q.countries.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
  if (countries.length) filters.push(`authorships.institutions.country_code:${countries.join("|")}`);
  const subfields = q.subfields.filter((s) => /^\d+$/.test(s));
  if (subfields.length) filters.push(`primary_topic.subfield.id:${subfields.join("|")}`);
  const keywords = q.keywords.map(clean).filter((k) => k.length > 1).slice(0, 12);
  if (keywords.length) filters.push(`title_and_abstract.search:${keywords.join("|")}`);
  if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) filters.push(`from_publication_date:${q.from}`);
  if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) filters.push(`to_publication_date:${q.to}`);
  if (!filters.length) return { works: [], total: 0 };

  const works: Work[] = [];
  let cursor: string | null = "*";
  let total = 0;
  while (cursor && works.length < q.max) {
    const params: URLSearchParams = new URLSearchParams({
      filter: filters.join(","),
      sort: q.sort === "cite" ? "cited_by_count:desc" : "publication_date:desc",
      per_page: String(Math.min(100, q.max - works.length)),
      select: SELECT,
      cursor,
    });
    const page: WorksPage = await get<WorksPage>("works", params);
    total = page.meta.count;
    works.push(...page.results.filter((w) => w.display_name).map((w) => toWork(w, countries)));
    cursor = page.results.length ? page.meta.next_cursor : null;
    if (cursor && works.length < q.max) await onLog?.(`OpenAlex : ${works.length} publication(s) sur ${total}…`);
  }
  return { works: works.slice(0, q.max), total };
}
