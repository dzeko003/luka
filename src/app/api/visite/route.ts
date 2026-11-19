import { db, schema } from "@/db";
import { clientIp, countryOf, visitorId } from "@/lib/geo";

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor/i;

/** Compte une visite de la page d'accueil (appelé par le navigateur, donc sans les robots qui n'exécutent pas JavaScript). */
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOTS.test(ua)) return new Response(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { path?: unknown; referrer?: unknown } | null;
  const path = typeof body?.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 200) : "/";
  let referrer: string | null = null;
  try {
    const host = typeof body?.referrer === "string" && body.referrer ? new URL(body.referrer).host : "";
    const self = new URL(req.url).host;
    referrer = host && host !== self && host !== req.headers.get("host") ? host.slice(0, 120) : null;
  } catch {
    referrer = null;
  }
  const ip = clientIp(req.headers);
  await db
    .insert(schema.visits)
    .values({ path, country: countryOf(ip), visitor: visitorId(ip, ua), referrer })
    .catch((e) => console.error(`[visites] non enregistrée : ${(e as Error).message}`));
  return new Response(null, { status: 204 });
}
