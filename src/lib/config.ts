// Configuration centrale : limites et fournisseurs (lue depuis l'environnement)

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export type RefreshFrequency = "hebdo" | "mensuelle";

export const limits = {
  free: {
    collectesPerDay: num(process.env.FREE_COLLECTES_PER_DAY, 5),
    maxRows: num(process.env.FREE_MAX_ROWS, 200),
    maxQueries: num(process.env.FREE_MAX_QUERIES, 3),
    pagesPerQuery: 4,
    charsPerPage: 6000,
    /** Sites web d'établissements lus pour compléter contacts et réseaux sociaux. */
    maxEnrichSites: num(process.env.FREE_MAX_ENRICH_SITES, 25),
    /** Lieux dont l'arrondissement et le quartier sont retrouvés par leurs coordonnées (1 par seconde). */
    maxReverseGeocode: num(process.env.FREE_MAX_REVERSE_GEOCODE, 200),
    /** Enrichissement d'un fichier : lignes complétées au maximum (une recherche web par ligne). */
    maxEnrichRows: num(process.env.FREE_MAX_ENRICH_ROWS, 20),
  },
  /** Premium : sources payantes (Google Maps et réseaux sociaux via Apify), volumes plus élevés. */
  premium: {
    collectesPerDay: num(process.env.PREMIUM_COLLECTES_PER_DAY, 30),
    maxRows: num(process.env.PREMIUM_MAX_ROWS, 10_000),
    maxQueries: num(process.env.PREMIUM_MAX_QUERIES, 12),
    pagesPerQuery: 5,
    charsPerPage: 8000,
    maxEnrichSites: num(process.env.PREMIUM_MAX_ENRICH_SITES, 200),
    maxReverseGeocode: num(process.env.PREMIUM_MAX_REVERSE_GEOCODE, 1000),
    maxEnrichRows: num(process.env.PREMIUM_MAX_ENRICH_ROWS, 300),
  },
  globalLlmCallsPerDay: num(process.env.GLOBAL_LLM_CALLS_PER_DAY, 500),
  maxConcurrentPerUser: 1,
  /** Colonnes maximum par collecte. */
  maxColumns: 25,
  /** Mise à jour automatique : collectes suivies et fréquences permises, selon la formule. */
  refresh: {
    free: { maxFollowed: num(process.env.FREE_MAX_FOLLOWED, 1), frequencies: ["mensuelle"] as RefreshFrequency[] },
    premium: { maxFollowed: num(process.env.PREMIUM_MAX_FOLLOWED, 10), frequencies: ["hebdo", "mensuelle"] as RefreshFrequency[] },
  },
  /** Enrichissement : lignes acceptées à l'import (au-delà de la limite de la formule, le reste est ignoré). */
  maxImportRows: 2000,
  /** Collectes exécutées en même temps par le serveur ; les autres attendent dans la file. */
  workerConcurrency: num(process.env.WORKER_CONCURRENCY, 2),
  /** Plafond technique d'une collecte, toutes formules confondues. */
  hardMaxRows: 50_000,
};

export const llmFree = {
  provider: (() => {
    try {
      return new URL(process.env.LLM_BASE_URL ?? "").host;
    } catch {
      return "inconnu";
    }
  })(),
  baseUrl: process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1",
  apiKey: process.env.LLM_API_KEY ?? "",
  model: process.env.LLM_MODEL ?? "openai/gpt-oss-120b",
};

/** Prix du modèle IA, en dollars par million de jetons (pour estimer le coût par client). */
export const llmPricing = {
  inputPerMTok: num(process.env.LLM_PRICE_INPUT_USD_PER_MTOK, 0.15),
  outputPerMTok: num(process.env.LLM_PRICE_OUTPUT_USD_PER_MTOK, 0.6),
};
export const llmCostUsd = (promptTokens: number, completionTokens: number) =>
  (promptTokens * llmPricing.inputPerMTok + completionTokens * llmPricing.outputPerMTok) / 1_000_000;

export const tavilyKey = process.env.TAVILY_API_KEY ?? "";

/** Sources ouvertes : OpenStreetMap (Overpass pour les lieux, Nominatim pour les villes). */
export const openData = {
  /** Plusieurs serveurs Overpass séparés par des virgules : le suivant est essayé si l'un est saturé. */
  overpassUrls: (
    process.env.OVERPASS_URL ||
    "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  )
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),
  nominatimUrl: process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org",
  /** Les services OpenStreetMap demandent un User-Agent qui identifie l'application. */
  userAgent: process.env.CRAWLER_USER_AGENT || "Luka/1.0 (collecte de donnees ouvertes)",
};

export type Tier = "free" | "premium";
/** Limites de la formule d'une collecte ou d'un utilisateur. */
export const tierLimits = (tier: string | null | undefined) => (tier === "premium" ? limits.premium : limits.free);

/** Apify : robots Google Maps, Instagram et Facebook (Premium uniquement). */
export const apify = {
  token: process.env.APIFY_TOKEN ?? "",
  gmapsActor: process.env.APIFY_GMAPS_ACTOR || "compass~crawler-google-places",
  instagramActor: process.env.APIFY_INSTAGRAM_ACTOR || "apify~instagram-profile-scraper",
  facebookActor: process.env.APIFY_FACEBOOK_ACTOR || "apify~facebook-pages-scraper",
  /** Dépense maximale par collecte, en dollars : Apify arrête les robots au-delà. */
  maxUsdPerCollecte: num(process.env.APIFY_MAX_USD_PER_COLLECTE, 5),
};
