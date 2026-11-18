import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { openData } from "./config";

/**
 * Lecture d'une page web externe en toute sécurité.
 * Les adresses viennent de données externes (OpenStreetMap, pages web) : on refuse tout ce qui
 * pointe vers le réseau interne du serveur (localhost, base de données, réseau Docker…).
 */

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    if (v6 === "::" || v6 === "::1") return true;
    if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80")) return true;
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Protocole refusé");
  if (url.username || url.password) throw new Error("Identifiants dans l'URL refusés");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) throw new Error("Hôte interne refusé");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateIp)) throw new Error("Adresse interne refusée");
  return url;
}

/** Télécharge une page HTML publique (redirections vérifiées une à une, taille et durée limitées). */
export async function fetchPublicHtml(raw: string, { maxBytes = 1_000_000, timeoutMs = 12_000 } = {}) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": openData.userAgent, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/html/i.test(res.headers.get("content-type") ?? "")) throw new Error("Pas une page HTML");
    const reader = res.body?.getReader();
    if (!reader) return { url: url.toString(), html: "" };
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { url: url.toString(), html: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
  throw new Error("Trop de redirections");
}
