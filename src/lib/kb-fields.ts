import type { PlaceField } from "./connectors/places";

/* Champs de la base Luka, utilisables côté navigateur (formulaire de contribution) comme côté serveur. */

/** Champs gardés dans la base. Les notes et avis Google, les abonnés et les photos changent vite ou ne nous appartiennent pas. */
export const KB_FIELDS = [
  "nom",
  "categorie",
  "type",
  "description",
  "adresse",
  "rue",
  "quartier",
  "arrondissement",
  "ville",
  "telephone",
  "autre_contact",
  "whatsapp",
  "site_web",
  "email",
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "x",
  "youtube",
  "horaires",
  "statut",
  "latitude",
  "longitude",
] as const satisfies readonly PlaceField[];
export type KbField = (typeof KB_FIELDS)[number];
export const isKbField = (f: unknown): f is KbField => (KB_FIELDS as readonly string[]).includes(f as string);

/** Lignes acceptées par fichier de contribution. */
export const MAX_CONTRIBUTION_ROWS = 5000;

export const KB_LABELS: Record<KbField, string> = {
  nom: "Nom",
  categorie: "Catégorie",
  type: "Type / spécialité",
  description: "Description",
  adresse: "Adresse",
  rue: "Rue",
  quartier: "Quartier",
  arrondissement: "Arrondissement",
  ville: "Ville",
  telephone: "Téléphone",
  autre_contact: "Autre contact",
  whatsapp: "WhatsApp",
  site_web: "Site web",
  email: "E-mail",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X (Twitter)",
  youtube: "YouTube",
  horaires: "Horaires",
  statut: "Statut",
  latitude: "Latitude",
  longitude: "Longitude",
};

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const norm = (v: unknown) =>
  fold(String(v ?? ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Colonnes qui décrivent une personne : jamais versées dans la base. */
export const PERSONAL = /\b(prenoms?|directeur|directrice|gerante?|responsable|proprietaire|promoteur|personne|contact perso|age|naissance|cni|passeport|salaire|sexe|genre|domicile)\b/;

/** Devine le champ de la base d'après le libellé d'une colonne (fichier importé, colonne sans champ de lieu). */
export function guessField(label: string): KbField | null {
  const t = ` ${norm(label)} `;
  if (PERSONAL.test(t)) return null;
  const rules: [RegExp, KbField][] = [
    [/\b(nom|name|raison sociale|denomination|etablissement|entreprise|societe|structure|enseigne)\b/, "nom"],
    [/\bwhatsapp\b/, "whatsapp"],
    [/\b(e ?mail|courriel|mail)\b/, "email"],
    [/\b(tel|telephone|phone|mobile|portable|contact)\b/, "telephone"],
    [/\b(site|web|url|internet)\b/, "site_web"],
    [/\bfacebook|\bfb\b/, "facebook"],
    [/\binstagram|\binsta\b/, "instagram"],
    [/\btiktok\b/, "tiktok"],
    [/\blinkedin\b/, "linkedin"],
    [/\byoutube\b/, "youtube"],
    [/\b(twitter|x)\b/, "x"],
    [/\bquartier\b/, "quartier"],
    [/\barrondissement\b/, "arrondissement"],
    [/\b(ville|city|commune|localite)\b/, "ville"],
    [/\brue\b/, "rue"],
    [/\b(adresse|address|localisation)\b/, "adresse"],
    [/\b(categorie|category|secteur|activite|type d etablissement)\b/, "categorie"],
    [/\b(specialite|type)\b/, "type"],
    [/\bhoraires?|heures? d ouverture\b/, "horaires"],
    [/\b(description|presentation|services?)\b/, "description"],
    [/\b(statut|etat)\b/, "statut"],
    [/\b(latitude|lat)\b/, "latitude"],
    [/\b(longitude|lon|lng)\b/, "longitude"],
  ];
  return rules.find(([re]) => re.test(t))?.[1] ?? null;
}

/** La ville d'une zone « Brazzaville, République du Congo » → « Brazzaville ». */
export const cityOfZone = (zone: string | null | undefined) => zone?.split(",")[0].trim() || null;

export const kbKey = (name: string, city: string) => `${norm(name)}|${norm(city)}`;

