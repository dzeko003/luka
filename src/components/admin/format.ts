/* Mise en forme des nombres, montants, dates et pays dans l'administration. */

export const int = (n: number) => n.toLocaleString("fr-FR");
export const usd = (n: number, digits = 2) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} $`;
/** Coût IA : souvent quelques centimes, affiché avec plus de précision. */
export const usdSmall = (n: number) => (n === 0 ? "0 $" : n < 0.01 ? "< 0,01 $" : usd(n, n < 1 ? 3 : 2));
export const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

const TZ = "Africa/Brazzaville";
export const dateShort = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ });
export const dateTime = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });

const regions = new Intl.DisplayNames(["fr"], { type: "region" });
/** Nom du pays en français (code ISO à deux lettres), « Inconnu » sinon. */
export function countryName(code: string | null) {
  if (!code) return "Inconnu";
  try {
    return regions.of(code) ?? code;
  } catch {
    return code;
  }
}
/** Drapeau (émoji) d'un code pays. */
export const flag = (code: string | null) =>
  code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "🌐";

export const PAYMENT_METHODS: Record<string, string> = {
  mobile_money: "Mobile Money",
  especes: "Espèces",
  virement: "Virement",
  autre: "Autre",
};

export const LOGIN_METHODS: Record<string, string> = {
  email: "E-mail",
  google: "Google",
  "2fa": "E-mail + code",
  lien: "Lien d'activation",
};

export const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  pending: { label: "En attente", tone: "neutral" },
  running: { label: "En cours", tone: "info" },
  done: { label: "Terminée", tone: "success" },
  failed: { label: "Échec", tone: "danger" },
};

export const COLUMN_TYPES: Record<string, string> = {
  texte: "texte",
  nombre: "nombre",
  url: "lien",
  date: "date",
  booleen: "oui/non",
};

export const providerLabel = (p: string) =>
  p
    .split(",")
    .filter(Boolean)
    .map((x) => (x === "credential" ? "E-mail" : x === "google" ? "Google" : x))
    .join(" · ") || "—";
