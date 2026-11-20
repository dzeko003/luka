import { apify } from "../config";
import type { Place } from "./places";

/**
 * Apify (https://apify.com) : plateforme de robots de collecte (« Actors »), réservée à Premium.
 * Chaque exécution reçoit un plafond de dépense (maxTotalChargeUsd) et un nombre maximum de
 * résultats : Apify arrête le robot dès qu'une des limites est atteinte.
 */

const API = "https://api.apify.com/v2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const apifyAvailable = () => Boolean(apify.token);

type Run = {
  id: string;
  status: "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMING-OUT" | "TIMED-OUT" | "ABORTING" | "ABORTED";
  statusMessage?: string;
  defaultDatasetId: string;
  usageTotalUsd?: number;
  chargedEventCounts?: Record<string, number>;
  pricingInfo?: {
    pricingPerEvent?: {
      actorChargeEvents?: Record<string, { eventPriceUsd?: number; eventTieredPricingUsd?: Record<string, { tieredEventPriceUsd: number }> }>;
    };
  };
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apify.token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text.slice(0, 200);
    try {
      message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
    } catch {
      /* réponse non JSON */
    }
    throw new Error(`Apify (${res.status}) : ${message}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Coût d'une exécution. Apify inclut déjà les événements facturés dans usageTotalUsd ; le calcul par
 * événements (prix du palier gratuit) ne sert que si ce total est absent.
 */
function costOf(run: Run) {
  if (run.usageTotalUsd) return Math.round(run.usageTotalUsd * 10_000) / 10_000;
  let cost = 0;
  const events = run.pricingInfo?.pricingPerEvent?.actorChargeEvents ?? {};
  for (const [name, count] of Object.entries(run.chargedEventCounts ?? {})) {
    const e = events[name];
    const price = e?.eventPriceUsd ?? e?.eventTieredPricingUsd?.FREE?.tieredEventPriceUsd ?? 0;
    cost += count * price;
  }
  return Math.round(cost * 10_000) / 10_000;
}

/**
 * Lance un robot, attend la fin (ou le délai), puis lit tous ses résultats.
 * Même si le robot s'arrête sur une limite ou un délai, les résultats déjà obtenus sont gardés.
 */
export async function runActor<T>(
  actor: string,
  input: unknown,
  opts: { maxItems: number; maxUsd: number; timeoutSecs?: number; onProgress?: (msg: string) => Promise<void> },
): Promise<{ items: T[]; costUsd: number; status: Run["status"] }> {
  const timeoutSecs = opts.timeoutSecs ?? 1800;
  const params = new URLSearchParams({
    timeout: String(timeoutSecs),
    maxItems: String(Math.max(1, Math.floor(opts.maxItems))),
    maxTotalChargeUsd: opts.maxUsd.toFixed(2),
  });
  let { data: run } = await call<{ data: Run }>(`/acts/${encodeURIComponent(actor)}/runs?${params}`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  const deadline = Date.now() + (timeoutSecs + 120) * 1000;
  let lastMessage = "";
  while (!["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(run.status)) {
    if (Date.now() > deadline) {
      await call(`/actor-runs/${run.id}/abort`, { method: "POST" }).catch(() => {});
      break;
    }
    // Attente côté serveur (jusqu'à 60 s) : pas besoin d'interroger Apify en boucle
    ({ data: run } = await call<{ data: Run }>(`/actor-runs/${run.id}?waitForFinish=60`));
    if (run.statusMessage && run.statusMessage !== lastMessage) {
      lastMessage = run.statusMessage;
      await opts.onProgress?.(run.statusMessage.slice(0, 160));
    }
    await sleep(500);
  }

  const items: T[] = [];
  for (let offset = 0; offset < opts.maxItems; offset += 1000) {
    const page = await call<T[]>(`/datasets/${run.defaultDatasetId}/items?clean=true&offset=${offset}&limit=1000`);
    items.push(...page);
    if (page.length < 1000) break;
  }
  if (!items.length && run.status !== "SUCCEEDED") throw new Error(`Apify : exécution ${run.status.toLowerCase()} sans résultat`);
  return { items: items.slice(0, opts.maxItems), costUsd: costOf(run), status: run.status };
}

/* ------------------------------------------------------------------ */
/* Google Maps                                                         */
/* ------------------------------------------------------------------ */

type GmapsItem = {
  searchString?: string;
  title?: string;
  categoryName?: string;
  categories?: string[];
  description?: string;
  address?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  price?: string;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  location?: { lat?: number; lng?: number };
  url?: string;
  placeId?: string;
  openingHours?: { day?: string; hours?: string }[];
  phones?: string[];
  additionalInfo?: Record<string, Record<string, boolean>[]>;
  hotelStars?: string;
  imageUrl?: string;
  emails?: string[];
  facebooks?: string[];
  instagrams?: string[];
  tiktoks?: string[];
  linkedIns?: string[];
  twitters?: string[];
  youtubes?: string[];
};

const firstOf = (a?: string[]) => a?.find(Boolean);

/** Services et équipements indiqués sur la fiche (« Wi-Fi gratuit », « Piscine »…), pour les remarques. */
function highlights(info: GmapsItem["additionalInfo"]) {
  const out: string[] = [];
  for (const group of Object.values(info ?? {}))
    for (const entry of group ?? []) for (const [label, yes] of Object.entries(entry)) if (yes) out.push(label);
  return out.slice(0, 8).join(", ") || undefined;
}

/** « Petit budget », « Moyen » ou « Haut de gamme », d'après les étoiles d'un hôtel ou le prix affiché. */
function priceLevel(it: GmapsItem) {
  const stars = Number(it.hotelStars?.match(/(\d)\s*étoile/)?.[1]);
  if (stars) return stars >= 4 ? "Haut de gamme" : stars === 3 ? "Moyen" : "Petit budget";
  const usd = Number(it.price?.replace(/\s/g, "").match(/^(\d+)\$US$/)?.[1]);
  if (usd) return usd > 90 ? "Haut de gamme" : usd >= 40 ? "Moyen" : "Petit budget";
  const signs = it.price?.match(/^[$€£]+$/)?.[0].length;
  if (signs) return signs >= 3 ? "Haut de gamme" : signs === 2 ? "Moyen" : "Petit budget";
  return undefined;
}

export function gmapsToPlace(it: GmapsItem): Place | null {
  if (!it.title) return null;
  const url = it.url || (it.placeId ? `https://www.google.com/maps/place/?q=place_id:${it.placeId}` : "");
  return {
    url,
    fields: {
      nom: it.title,
      categorie: it.categoryName,
      type: [it.hotelStars, it.categories?.slice(1, 4).join(", ")].filter(Boolean).join(" · ") || undefined,
      description: it.description,
      adresse: it.address,
      rue: it.street,
      quartier: it.neighborhood,
      ville: it.city,
      telephone: it.phone || it.phoneUnformatted,
      // Un second numéro, sinon l'email : ce que les annuaires appellent « autre contact »
      autre_contact: it.phones?.find((p) => p && p !== it.phone && p !== it.phoneUnformatted) || firstOf(it.emails),
      remarques: [it.description, highlights(it.additionalInfo)].filter(Boolean).join(" — ") || undefined,
      site_web: it.website,
      email: firstOf(it.emails),
      facebook: firstOf(it.facebooks),
      instagram: firstOf(it.instagrams),
      tiktok: firstOf(it.tiktoks),
      linkedin: firstOf(it.linkedIns),
      x: firstOf(it.twitters),
      youtube: firstOf(it.youtubes),
      horaires: it.openingHours?.length
        ? it.openingHours.map((h) => `${h.day} ${(h.hours ?? "").replace(/ to /g, "–")}`).join(" · ")
        : undefined,
      niveau_prix: priceLevel(it),
      photo: it.imageUrl,
      note: it.totalScore || undefined,
      nombre_avis: it.reviewsCount,
      prix: it.price,
      statut: it.permanentlyClosed ? "Fermé définitivement" : it.temporarilyClosed ? "Fermé temporairement" : "Ouvert",
      latitude: it.location?.lat,
      longitude: it.location?.lng,
      lien_carte: url || undefined,
    },
  };
}

/** Lieux Google Maps d'une zone, pour une ou plusieurs recherches (« restaurant », « hôtel »…). */
export async function searchGoogleMaps(
  zone: string,
  searches: string[],
  opts: { maxPlaces: number; maxUsd: number; contacts: boolean; onProgress?: (msg: string) => Promise<void> },
) {
  const perSearch = Math.max(10, Math.ceil(opts.maxPlaces / Math.max(1, searches.length)));
  const { items, costUsd, status } = await runActor<GmapsItem>(
    apify.gmapsActor,
    {
      searchStringsArray: searches.slice(0, 20),
      locationQuery: zone,
      maxCrawledPlacesPerSearch: perSearch,
      language: "fr",
      scrapeContacts: opts.contacts, // emails et réseaux sociaux trouvés sur le site de chaque lieu
      skipClosedPlaces: false,
      maxReviews: 0,
      maxImages: 0,
      scrapeReviewsPersonalData: false,
    },
    { maxItems: opts.maxPlaces, maxUsd: opts.maxUsd, onProgress: opts.onProgress },
  );
  const places = items.map(gmapsToPlace).filter((p): p is Place => p !== null);
  return { places, costUsd, status };
}

/**
 * Enrichissement : cherche chaque établissement par son nom (un seul résultat par recherche).
 * Rend la fiche trouvée pour chaque recherche ; c'est à l'appelant de vérifier que le nom correspond.
 */
export async function lookupGoogleMaps(zone: string, names: string[], opts: { maxUsd: number; contacts: boolean }) {
  const { items, costUsd } = await runActor<GmapsItem>(
    apify.gmapsActor,
    {
      searchStringsArray: names,
      locationQuery: zone,
      maxCrawledPlacesPerSearch: 1,
      language: "fr",
      scrapeContacts: opts.contacts,
      skipClosedPlaces: false,
      maxReviews: 0,
      maxImages: 0,
      scrapeReviewsPersonalData: false,
    },
    { maxItems: names.length * 2, maxUsd: opts.maxUsd },
  );
  const found = new Map<string, Place>();
  for (const it of items) {
    const p = gmapsToPlace(it);
    if (p && it.searchString && !found.has(it.searchString)) found.set(it.searchString, p);
  }
  return { found, costUsd };
}

/* ------------------------------------------------------------------ */
/* Réseaux sociaux                                                     */
/* ------------------------------------------------------------------ */

export type SocialProfile = {
  followers?: number;
  description?: string;
  email?: string;
  telephone?: string;
  site_web?: string;
  adresse?: string;
  categorie?: string;
};

/** Identifiant Instagram à partir d'un lien (instagram.com/nom/ → nom). */
export function instagramUsername(url: string) {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  return m && !["p", "reel", "explore", "accounts", "stories"].includes(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
}

/** Profils Instagram publics (comptes professionnels surtout) : abonnés, bio, site. Clé : identifiant. */
export async function instagramProfiles(usernames: string[], maxUsd: number) {
  const { items, costUsd } = await runActor<{
    username?: string;
    biography?: string;
    followersCount?: number;
    externalUrl?: string;
    businessCategoryName?: string;
    publicEmail?: string;
    businessEmail?: string;
    businessPhoneNumber?: string;
    publicPhoneNumber?: string;
  }>(apify.instagramActor, { usernames }, { maxItems: usernames.length, maxUsd, timeoutSecs: 900 });
  const out = new Map<string, SocialProfile>();
  for (const it of items) {
    if (!it.username) continue;
    out.set(it.username.toLowerCase(), {
      followers: it.followersCount,
      description: it.biography,
      site_web: it.externalUrl,
      categorie: it.businessCategoryName,
      email: it.publicEmail || it.businessEmail,
      telephone: it.publicPhoneNumber || it.businessPhoneNumber,
    });
  }
  return { profiles: out, costUsd };
}

const normFb = (url: string) =>
  url
    .toLowerCase()
    .replace(/^https?:\/\/(www\.|m\.|web\.|[a-z]{2}-[a-z]{2}\.)?(facebook|fb)\.com\//, "")
    .replace(/[/?#].*$/, "");

/** Pages Facebook publiques : abonnés, téléphone, email, site, adresse. Clé : identifiant de la page. */
export async function facebookPages(urls: string[], maxUsd: number) {
  const { items, costUsd } = await runActor<{
    facebookUrl?: string;
    pageUrl?: string;
    url?: string;
    inputUrl?: string;
    followers?: number;
    likes?: number;
    intro?: string;
    info?: string[];
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    categories?: string[];
  }>(apify.facebookActor, { startUrls: urls.map((url) => ({ url })) }, { maxItems: urls.length, maxUsd, timeoutSecs: 900 });
  const out = new Map<string, SocialProfile>();
  for (const it of items) {
    const key = normFb(it.inputUrl || it.facebookUrl || it.pageUrl || it.url || "");
    if (!key) continue;
    out.set(key, {
      followers: it.followers ?? it.likes,
      description: it.intro || it.info?.join(" ") || undefined,
      email: it.email,
      telephone: it.phone,
      site_web: it.website,
      adresse: it.address,
      categorie: it.categories?.join(", "),
    });
  }
  return { pages: out, costUsd, key: normFb };
}
