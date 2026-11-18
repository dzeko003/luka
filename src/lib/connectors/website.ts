import { fetchPublicHtml } from "../safe-fetch";

/**
 * Lecture du site web d'un établissement : on y trouve souvent l'email, le téléphone
 * et les liens vers ses pages Facebook, Instagram, TikTok… (sans IA : lecture directe du HTML).
 */

export type WebsiteContacts = {
  email?: string;
  telephone?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  linkedin?: string;
  youtube?: string;
  x?: string;
  whatsapp?: string;
  pageUrl: string;
};

const SOCIAL: { key: keyof WebsiteContacts; re: RegExp; reject?: RegExp }[] = [
  {
    key: "facebook",
    re: /https?:\/\/(?:www\.|m\.|web\.|[a-z]{2}-[a-z]{2}\.)?(?:facebook|fb)\.com\/[^\s"'<>?#]+/gi,
    reject: /\/(sharer|share|dialog|plugins|tr|login|privacy|policies|help|ajax|security|ig_xsite|events\/?$)|\.(gif|png|jpe?g|js|css)$/i,
  },
  { key: "instagram", re: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>?#]+/gi, reject: /\/(p|reel|explore|accounts|stories)\//i },
  { key: "tiktok", re: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>?#/]+/gi },
  { key: "linkedin", re: /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in|school)\/[^\s"'<>?#]+/gi, reject: /shareArticle/i },
  { key: "youtube", re: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[^\s"'<>?#]+/gi },
  { key: "x", re: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]{2,}(?=["'\s/?<]|$)/gi, reject: /\/(intent|share|home|search)\b/i },
  { key: "whatsapp", re: /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)[0-9+]+/gi },
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const IGNORED_EMAIL = /(example|exemple|domain|sentry|wixpress|\.png|\.jpe?g|\.gif|\.webp|\.svg|@2x)/i;

function decode(html: string) {
  return html
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;|&period;/gi, ".")
    .replace(/&amp;/gi, "&")
    .replace(/\\\//g, "/");
}

function cleanPhone(raw: string) {
  const p = decodeURIComponent(raw).replace(/[^\d+]/g, "");
  const digits = p.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? p : undefined;
}

function extract(html: string, pageUrl: string): WebsiteContacts {
  const text = decode(html);
  const out: WebsiteContacts = { pageUrl };

  for (const s of SOCIAL) {
    const match = [...text.matchAll(s.re)].map((m) => m[0].replace(/[).,;]+$/, "")).find((u) => !s.reject?.test(u));
    if (match) out[s.key] = match as never;
  }

  const mailto = text.match(/mailto:([^"'?\s>]+)/i)?.[1];
  const email = (mailto ? decodeURIComponent(mailto) : undefined) ?? text.match(EMAIL_RE)?.find((e) => !IGNORED_EMAIL.test(e));
  if (email && !IGNORED_EMAIL.test(email)) out.email = email.toLowerCase();

  const tel = text.match(/href=["']tel:([^"']+)["']/i)?.[1];
  // À défaut de lien « tel: », un numéro au format international dans le texte de la page
  const intl = text.replace(/<[^>]+>/g, " ").match(/(?:\+|00)\d{2,3}[\s.()-]?(?:\d[\s.()-]?){7,12}\d/)?.[0];
  out.telephone = (tel && cleanPhone(tel)) || (intl && cleanPhone(intl)) || undefined;

  return out;
}

/** Repère sur l'accueil un lien vers la page contact du même site. */
function contactLink(html: string, base: string) {
  const hrefs = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)];
  const hit = hrefs.find(([, href, label]) => /contact|nous-joindre|joindre|about|a-propos|qui-sommes/i.test(`${href} ${label}`));
  if (!hit) return null;
  try {
    const url = new URL(hit[1], base);
    return url.host === new URL(base).host ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Lit l'accueil du site, puis la page contact si des informations manquent encore. */
export async function readWebsiteContacts(website: string): Promise<WebsiteContacts | null> {
  const start = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const home = await fetchPublicHtml(start);
  const found = extract(home.html, home.url);
  const missing = !found.email || !found.telephone || !found.facebook || !found.instagram;
  const contactUrl = missing ? contactLink(home.html, home.url) : null;
  if (contactUrl) {
    try {
      const page = await fetchPublicHtml(contactUrl);
      const more = extract(page.html, page.url);
      for (const [k, v] of Object.entries(more) as [keyof WebsiteContacts, string][]) {
        if (k !== "pageUrl" && v && !found[k]) found[k] = v as never;
      }
    } catch {
      /* page contact illisible : on garde ce que l'accueil a donné */
    }
  }
  const { pageUrl, ...rest } = found;
  void pageUrl;
  return Object.values(rest).some(Boolean) ? found : null;
}
