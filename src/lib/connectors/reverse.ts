import { openData } from "../config";

/**
 * Adresse à partir des coordonnées GPS (Nominatim, OpenStreetMap) : arrondissement, quartier, rue.
 * Le service public impose une requête par seconde au maximum, pour toute l'application :
 * les appels passent donc par une file unique, et les résultats sont gardés en mémoire.
 */

export type ReverseAddress = { arrondissement?: string; quartier?: string; rue?: string };

const state = globalThis as unknown as {
  lukaReverse?: { cache: Map<string, ReverseAddress | null>; queue: Promise<unknown> };
};
const shared = (state.lukaReverse ??= { cache: new Map(), queue: Promise.resolve() });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** « Poto-Poto (arrondissement 3) » → « 3 – Poto-Poto » (format des annuaires congolais). */
function formatArrondissement(raw?: string) {
  if (!raw) return undefined;
  const m = raw.match(/^(.*?)\s*\((?:arrondissement|arr\.?)\s*(\d+)\)\s*$/i);
  return m ? `${m[2]} – ${m[1].trim()}` : raw.replace(/\s*\((commune|département)\)$/i, "");
}

async function lookup(lat: number, lon: number): Promise<ReverseAddress | null> {
  const url = `${openData.nominatimUrl}/reverse?${new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lon),
    zoom: "17",
    "accept-language": "fr",
  })}`;
  const res = await fetch(url, { headers: { "User-Agent": openData.userAgent }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const a = ((await res.json()) as { address?: Record<string, string> }).address;
  if (!a) return null;
  const district = a.city_district || a.county || a.district;
  const arrondissement = /arrondissement/i.test(district ?? "") ? formatArrondissement(district) : undefined;
  const arrName = arrondissement?.replace(/^\d+ – /, "");
  // Le quartier le plus précis, sans répéter le nom de l'arrondissement
  const quartier = [a.neighbourhood, a.quarter, a.suburb].find((q) => q && q !== arrName);
  return { arrondissement, quartier, rue: a.road };
}

export function reverseGeocode(lat: number, lon: number): Promise<ReverseAddress | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (shared.cache.has(key)) return Promise.resolve(shared.cache.get(key)!);
  const job = shared.queue.then(async () => {
    if (shared.cache.has(key)) return shared.cache.get(key)!;
    try {
      const r = await lookup(lat, lon);
      shared.cache.set(key, r);
      return r;
    } catch {
      return null;
    } finally {
      await sleep(1100);
    }
  });
  shared.queue = job.catch(() => {});
  return job;
}
