import { createHash } from "node:crypto";
import geoip from "geoip-country";

/** Adresse IP du visiteur : premier maillon de X-Forwarded-For (posé par Traefik), sinon X-Real-IP. */
export function clientIp(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || headers.get("x-real-ip") || null;
}

/** Pays (code ISO à deux lettres) d'une adresse IP, d'après la base GeoLite2 embarquée. Null si inconnu. */
export function countryOf(ip: string | null): string | null {
  if (!ip) return null;
  try {
    return geoip.lookup(ip.replace(/^::ffff:/, ""))?.country || null;
  } catch {
    return null;
  }
}

/** Empreinte anonyme d'un visiteur pour la journée : compte les visiteurs uniques sans garder l'adresse IP. */
export function visitorId(ip: string | null, userAgent: string, day = new Date().toISOString().slice(0, 10)) {
  return createHash("sha256")
    .update(`${ip ?? "?"}|${userAgent}|${day}|${process.env.BETTER_AUTH_SECRET ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}
