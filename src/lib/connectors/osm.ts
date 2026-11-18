import { openData } from "../config";
import type { Place } from "./places";

/**
 * OpenStreetMap : la carte libre et collaborative (licence ODbL, attribution obligatoire).
 * - Nominatim trouve la zone (ville, pays) ;
 * - Overpass renvoie tous les lieux de cette zone qui correspondent aux filtres (restaurants, hôtels…).
 * Les données arrivent déjà structurées : aucune IA n'est nécessaire pour les lire.
 */

export const OSM_ATTRIBUTION = "OpenStreetMap (© contributeurs OSM, licence ODbL)";

export type OsmFilter = { key: string; values: string[] };

type Element = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Libellés français des catégories les plus courantes */
const LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  fast_food: "Restauration rapide",
  cafe: "Café",
  bar: "Bar",
  pub: "Pub",
  nightclub: "Boîte de nuit",
  hotel: "Hôtel",
  guest_house: "Maison d'hôtes",
  hostel: "Auberge",
  motel: "Motel",
  apartment: "Appartement",
  cinema: "Cinéma",
  theatre: "Théâtre",
  arts_centre: "Centre culturel",
  museum: "Musée",
  library: "Bibliothèque",
  school: "École",
  college: "Lycée / collège",
  university: "Université",
  kindergarten: "École maternelle",
  hospital: "Hôpital",
  clinic: "Clinique",
  doctors: "Cabinet médical",
  dentist: "Dentiste",
  pharmacy: "Pharmacie",
  bank: "Banque",
  atm: "Distributeur",
  bureau_de_change: "Bureau de change",
  fuel: "Station-service",
  marketplace: "Marché",
  place_of_worship: "Lieu de culte",
  police: "Police",
  townhall: "Mairie",
  post_office: "Bureau de poste",
  coworking_space: "Espace de coworking",
  supermarket: "Supermarché",
  bakery: "Boulangerie",
  hairdresser: "Coiffeur",
  beauty: "Institut de beauté",
  clothes: "Vêtements",
  mobile_phone: "Téléphonie",
  car_repair: "Garage",
  sports_centre: "Centre sportif",
  stadium: "Stade",
  swimming_pool: "Piscine",
  park: "Parc",
  fitness_centre: "Salle de sport",
  attraction: "Attraction",
  embassy: "Ambassade",
  ngo: "ONG",
  company: "Entreprise",
};

const CATEGORY_KEYS = ["amenity", "tourism", "shop", "leisure", "office", "healthcare", "craft", "club", "historic"];

/* ------------------------------------------------------------------ */
/* Zone : ville, région ou pays                                        */
/* ------------------------------------------------------------------ */

type Zone = { label: string; areaId: number | null; lat: number; lon: number };

async function findZone(query: string): Promise<Zone | null> {
  const url = `${openData.nominatimUrl}/search?${new URLSearchParams({ q: query, format: "jsonv2", limit: "5", "accept-language": "fr" })}`;
  const res = await fetch(url, { headers: { "User-Agent": openData.userAgent }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Recherche de la zone « ${query} » en échec (${res.status})`);
  const results = (await res.json()) as { osm_type: string; osm_id: number; lat: string; lon: string; display_name: string; name?: string; class: string }[];
  if (!results.length) return null;
  // Un contour administratif permet de chercher dans toute la ville ; sinon on cherche autour du point
  const best = results.find((r) => r.osm_type === "relation" && r.class === "boundary") ?? results.find((r) => r.osm_type === "relation") ?? results[0];
  return {
    label: (best.name || best.display_name.split(",")[0]).replace(/\s*\(.*\)$/, ""),
    areaId: best.osm_type === "relation" ? 3_600_000_000 + best.osm_id : null,
    lat: Number(best.lat),
    lon: Number(best.lon),
  };
}

/* ------------------------------------------------------------------ */
/* Requête Overpass                                                    */
/* ------------------------------------------------------------------ */

const SAFE_KEY = /^[a-z_:]{2,40}$/;
const SAFE_VALUE = /^[a-z0-9_-]{1,40}$/;

function buildQuery(zone: Zone, filters: OsmFilter[], limit: number) {
  const scope = zone.areaId ? "(area.zone)" : `(around:15000,${zone.lat},${zone.lon})`;
  const parts = filters
    .filter((f) => SAFE_KEY.test(f.key))
    .map((f) => ({ key: f.key, values: f.values.filter((v) => SAFE_VALUE.test(v)) }))
    .filter((f) => f.values.length)
    .map((f) => `nwr${scope}["${f.key}"~"^(${f.values.join("|")})$"]["name"];`);
  if (!parts.length) return null;
  return `[out:json][timeout:120];${zone.areaId ? `area(${zone.areaId})->.zone;` : ""}(${parts.join("")});out center tags ${limit};`;
}

async function overpass(query: string): Promise<Element[]> {
  let lastError = "aucun serveur configuré";
  for (const endpoint of openData.overpassUrls) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": openData.userAgent, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(150_000),
        });
        const text = await res.text();
        if (res.ok && text.trimStart().startsWith("{")) return (JSON.parse(text) as { elements?: Element[] }).elements ?? [];
        lastError = `${new URL(endpoint).host} : ${res.status}`;
        // Serveur saturé : on patiente un peu, puis on passe au suivant
        if (res.status === 429 || res.status >= 500) await sleep(3000 * (attempt + 1));
        else break;
      } catch (e) {
        lastError = `${new URL(endpoint).host} : ${(e as Error).message}`;
      }
    }
  }
  throw new Error(`Serveurs OpenStreetMap indisponibles (${lastError})`);
}

/* ------------------------------------------------------------------ */
/* Conversion d'une fiche en champs                                    */
/* ------------------------------------------------------------------ */

const first = (t: Record<string, string>, ...keys: string[]) => keys.map((k) => t[k]).find((v) => v && v.trim()) ?? undefined;

function socialUrl(value: string | undefined, domain: string) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://www.${domain}/${value.replace(/^@/, "").replace(/^\/+/, "")}`;
}

export function toPlace(el: Element, zoneLabel: string): Place {
  const t = el.tags ?? {};
  const catKey = CATEGORY_KEYS.find((k) => t[k]);
  const catValue = catKey ? t[catKey] : undefined;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const street = [first(t, "addr:housenumber"), first(t, "addr:street")].filter(Boolean).join(" ") || undefined;
  const quartier = first(t, "addr:suburb", "addr:quarter", "addr:neighbourhood", "addr:district");
  const ville = first(t, "addr:city") ?? zoneLabel;
  const typeParts = [first(t, "cuisine")?.replace(/;/g, ", "), t.stars ? `${t.stars}★` : undefined].filter(Boolean);

  return {
    url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    fields: {
      nom: t.name,
      categorie: catValue ? (LABELS[catValue] ?? catValue.replace(/_/g, " ")) : undefined,
      type: typeParts.join(" · ") || undefined,
      adresse: [street, quartier, first(t, "addr:city")].filter(Boolean).join(", ") || first(t, "addr:full"),
      rue: street,
      quartier,
      ville,
      telephone: first(t, "phone", "contact:phone", "contact:mobile", "mobile")?.split(";")[0].trim(),
      autre_contact:
        [first(t, "phone", "contact:phone")?.split(";")[1], first(t, "contact:whatsapp", "whatsapp"), first(t, "email", "contact:email")]
          .map((v) => v?.trim())
          .find(Boolean),
      remarques: first(t, "description", "note"),
      whatsapp: first(t, "contact:whatsapp", "whatsapp"),
      photo: [first(t, "image")].find((u) => u && /^https?:\/\//.test(u)),
      site_web: first(t, "website", "contact:website", "url"),
      email: first(t, "email", "contact:email"),
      facebook: socialUrl(first(t, "contact:facebook", "facebook"), "facebook.com"),
      instagram: socialUrl(first(t, "contact:instagram", "instagram"), "instagram.com"),
      horaires: first(t, "opening_hours"),
      latitude: lat,
      longitude: lon,
      lien_carte: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    },
  };
}

/**
 * Cherche les lieux d'une ou plusieurs zones. Les zones sont lues l'une après l'autre
 * (les services publics demandent de ne pas les solliciter en parallèle).
 */
export async function searchOsmPlaces(
  zones: string[],
  filters: OsmFilter[],
  limit: number,
  log: (msg: string, level?: "info" | "warn") => Promise<void>,
): Promise<Place[]> {
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const zoneQuery of zones.slice(0, 5)) {
    if (places.length >= limit) break;
    let zone: Zone | null;
    try {
      zone = await findZone(zoneQuery);
    } catch (e) {
      await log((e as Error).message, "warn");
      continue;
    }
    if (!zone) {
      await log(`Zone introuvable sur OpenStreetMap : « ${zoneQuery} »`, "warn");
      continue;
    }
    const query = buildQuery(zone, filters, limit - places.length);
    if (!query) return places;
    await log(`OpenStreetMap : recherche à ${zone.label}…`);
    try {
      const elements = await overpass(query);
      let added = 0;
      for (const el of elements) {
        const p = toPlace(el, zone.label);
        if (!p.fields.nom || seen.has(p.url)) continue;
        seen.add(p.url);
        places.push(p);
        added++;
      }
      await log(`OpenStreetMap : ${added} lieu(x) trouvé(s) à ${zone.label}.`);
    } catch (e) {
      await log((e as Error).message, "warn");
    }
    await sleep(1100); // Nominatim : une requête par seconde au maximum
  }
  return places.slice(0, limit);
}

/** Fiches précises à partir de leurs liens openstreetmap.org/{type}/{id} (pour reconstruire une collecte). */
export async function osmPlacesByUrl(urls: string[], zoneLabel: (url: string) => string): Promise<Place[]> {
  const ids = urls
    .map((u) => u.match(/openstreetmap\.org\/(node|way|relation)\/(\d+)/))
    .filter((m): m is RegExpMatchArray => m !== null);
  if (!ids.length) return [];
  const byType = (t: string) => ids.filter((m) => m[1] === t).map((m) => m[2]);
  const parts = ["node", "way", "relation"].filter((t) => byType(t).length).map((t) => `${t}(id:${byType(t).join(",")});`);
  const elements = await overpass(`[out:json][timeout:120];(${parts.join("")});out center tags;`);
  return elements.map((el) => {
    const url = `https://www.openstreetmap.org/${el.type}/${el.id}`;
    return toPlace(el, zoneLabel(url));
  });
}
