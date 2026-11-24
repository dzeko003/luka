import { db, schema } from "@/db";
import { apify, limits } from "./config";
import { reportError } from "./monitoring";

/*
 * Réglages modifiables depuis la console d'administration.
 * Les valeurs vivent dans la table « settings » ; une clé absente reprend la valeur par défaut
 * (variable d'environnement, sinon valeur du code). Le site et le travailleur tournent dans des
 * processus séparés : chacun relit la table au plus toutes les 30 secondes, et applique les valeurs
 * directement dans `limits` et `apify`, que le reste du code lit déjà.
 */

export type SettingGroup = "ia" | "tavily" | "apify";

export type SettingDef = {
  key: string;
  group: SettingGroup;
  label: string;
  help: string;
  min: number;
  max: number;
  /** Nombre entier (sinon décimal, au centime près). */
  integer: boolean;
  unit?: string;
  get: () => number;
  set: (v: number) => void;
};

const tierSetting = (
  tier: "free" | "premium",
  field: "maxQueries" | "pagesPerQuery" | "maxEnrichRows" | "maxContactSearches",
  def: Omit<SettingDef, "key" | "get" | "set" | "integer">,
): SettingDef => ({
  key: `${tier}.${field}`,
  integer: true,
  ...def,
  get: () => limits[tier][field],
  set: (v) => {
    limits[tier][field] = v;
  },
});

export const SETTINGS: SettingDef[] = [
  {
    key: "globalLlmCallsPerDay",
    group: "ia",
    label: "Appels IA par jour, tous utilisateurs",
    help: "Au-delà, plus aucune collecte, suggestion ni mise à jour ne démarre jusqu'à minuit (UTC).",
    min: 0,
    max: 100_000,
    integer: true,
    unit: "appels",
    get: () => limits.globalLlmCallsPerDay,
    set: (v) => {
      limits.globalLlmCallsPerDay = v;
    },
  },
  tierSetting("free", "maxQueries", {
    group: "tavily",
    label: "Recherches web par collecte · Gratuit",
    help: "Recherches lancées quand les cartes n'ont pas donné assez de lignes.",
    min: 0,
    max: 50,
    unit: "recherches",
  }),
  tierSetting("premium", "maxQueries", {
    group: "tavily",
    label: "Recherches web par collecte · Premium",
    help: "Recherches lancées quand les cartes n'ont pas donné assez de lignes.",
    min: 0,
    max: 50,
    unit: "recherches",
  }),
  tierSetting("free", "pagesPerQuery", {
    group: "tavily",
    label: "Pages lues par recherche · Gratuit",
    help: "Chaque page est ensuite lue par l'IA : plus de pages, plus d'appels IA.",
    min: 1,
    max: 20,
    unit: "pages",
  }),
  tierSetting("premium", "pagesPerQuery", {
    group: "tavily",
    label: "Pages lues par recherche · Premium",
    help: "Chaque page est ensuite lue par l'IA : plus de pages, plus d'appels IA.",
    min: 1,
    max: 20,
    unit: "pages",
  }),
  tierSetting("free", "maxContactSearches", {
    group: "tavily",
    label: "Lieux sans contact cherchés par collecte · Gratuit",
    help: "Une recherche web et un appel IA par lieu.",
    min: 0,
    max: 500,
    unit: "lieux",
  }),
  tierSetting("premium", "maxContactSearches", {
    group: "tavily",
    label: "Lieux sans contact cherchés par collecte · Premium",
    help: "Une recherche web et un appel IA par lieu, avant Facebook et Instagram.",
    min: 0,
    max: 500,
    unit: "lieux",
  }),
  tierSetting("free", "maxEnrichRows", {
    group: "tavily",
    label: "Lignes complétées par fichier · Gratuit",
    help: "« Compléter un fichier » : une recherche web et un appel IA par ligne.",
    min: 0,
    max: 2000,
    unit: "lignes",
  }),
  tierSetting("premium", "maxEnrichRows", {
    group: "tavily",
    label: "Lignes complétées par fichier · Premium",
    help: "« Compléter un fichier » : Google Maps d'abord, puis une recherche web par ligne restante.",
    min: 0,
    max: 2000,
    unit: "lignes",
  }),
  {
    key: "apify.maxUsdPerCollecte",
    group: "apify",
    label: "Dépense maximale par collecte Premium",
    help: "Google Maps, Facebook et Instagram s'arrêtent une fois ce montant atteint. 0 désactive Apify.",
    min: 0,
    max: 200,
    integer: false,
    unit: "$",
    get: () => apify.maxUsdPerCollecte,
    set: (v) => {
      apify.maxUsdPerCollecte = v;
    },
  },
];

/** Valeurs par défaut (environnement ou code), relevées avant toute modification. */
export const DEFAULTS: Record<string, number> = Object.fromEntries(SETTINGS.map((s) => [s.key, s.get()]));

/** Vérifie une valeur saisie ; renvoie la valeur arrondie, ou un message d'erreur. */
export function checkSetting(def: SettingDef, raw: unknown): number | string {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return `${def.label} : nombre attendu.`;
  const v = def.integer ? Math.round(n) : Math.round(n * 100) / 100;
  if (v < def.min || v > def.max) return `${def.label} : entre ${def.min} et ${def.max}.`;
  return v;
}

const TTL_MS = 30_000;
let loadedAt = 0;
let pending: Promise<void> | null = null;

/** Applique les réglages enregistrés (relus au plus toutes les 30 secondes, ou tout de suite avec `force`). */
export function loadSettings(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < TTL_MS) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    try {
      const stored = new Map((await db.select().from(schema.settings)).map((r) => [r.key, r.value]));
      for (const def of SETTINGS) {
        const v = stored.get(def.key);
        const ok = v !== undefined ? checkSetting(def, v) : null;
        def.set(typeof ok === "number" ? ok : DEFAULTS[def.key]);
      }
    } catch (e) {
      // Base injoignable ou table absente : on garde les dernières valeurs connues
      reportError(e, { where: "settings.load" });
    } finally {
      loadedAt = Date.now();
      pending = null;
    }
  })();
  return pending;
}
