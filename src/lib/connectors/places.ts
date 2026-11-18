/**
 * Champs communs à toutes les sources de lieux (OpenStreetMap, Google Maps, réseaux sociaux).
 * L'IA associe chaque colonne de la collecte à l'un de ces champs ; chaque source remplit ce qu'elle connaît.
 */
export const PLACE_FIELDS = [
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
  "note",
  "nombre_avis",
  "prix",
  "niveau_prix",
  "photo",
  "statut",
  "remarques",
  "latitude",
  "longitude",
  "lien_carte",
  "instagram_abonnes",
  "facebook_abonnes",
] as const;
export type PlaceField = (typeof PLACE_FIELDS)[number];

export type Place = { fields: Partial<Record<PlaceField, string | number>>; url: string };

/** Champs qu'OpenStreetMap ne fournit jamais (utile pour décider d'utiliser une source payante). */
export const PREMIUM_ONLY_FIELDS: PlaceField[] = ["note", "nombre_avis", "prix", "instagram_abonnes", "facebook_abonnes"];

/**
 * Description des champs pour l'interface et pour l'IA qui suggère les colonnes.
 * `premium` : uniquement avec les sources payantes (Google Maps, réseaux sociaux).
 */
export const PLACE_CATALOG: Record<PlaceField, { label: string; type: "texte" | "nombre" | "url"; aide: string; premium?: boolean }> = {
  nom: { label: "Nom", type: "texte", aide: "nom de l'établissement" },
  categorie: { label: "Catégorie", type: "texte", aide: "restaurant, hôtel, bar…" },
  type: { label: "Type / spécialité", type: "texte", aide: "cuisine, étoiles, sous-catégories" },
  description: { label: "Description", type: "texte", aide: "courte présentation du lieu" },
  adresse: { label: "Adresse", type: "texte", aide: "adresse complète" },
  rue: { label: "Rue", type: "texte", aide: "rue et numéro" },
  quartier: { label: "Quartier", type: "texte", aide: "quartier, retrouvé d'après les coordonnées" },
  arrondissement: { label: "Arrondissement", type: "texte", aide: "division administrative de la ville" },
  ville: { label: "Ville", type: "texte", aide: "ville" },
  telephone: { label: "Téléphone", type: "texte", aide: "numéro principal" },
  autre_contact: { label: "Autre contact", type: "texte", aide: "second numéro ou email" },
  whatsapp: { label: "WhatsApp", type: "texte", aide: "numéro WhatsApp (rarement publié)" },
  site_web: { label: "Site web", type: "url", aide: "site officiel" },
  email: { label: "Email", type: "texte", aide: "email de contact, lu sur le site web" },
  facebook: { label: "Facebook", type: "url", aide: "page Facebook" },
  instagram: { label: "Instagram", type: "url", aide: "compte Instagram" },
  tiktok: { label: "TikTok", type: "url", aide: "compte TikTok" },
  linkedin: { label: "LinkedIn", type: "url", aide: "page LinkedIn" },
  x: { label: "X (Twitter)", type: "url", aide: "compte X" },
  youtube: { label: "YouTube", type: "url", aide: "chaîne YouTube" },
  horaires: { label: "Horaires", type: "texte", aide: "horaires d'ouverture, jour par jour" },
  note: { label: "Note Google", type: "nombre", aide: "note moyenne sur 5", premium: true },
  nombre_avis: { label: "Nombre d'avis", type: "nombre", aide: "nombre d'avis Google", premium: true },
  prix: { label: "Prix", type: "texte", aide: "prix affiché (chambre d'hôtel…)", premium: true },
  niveau_prix: { label: "Niveau de prix", type: "texte", aide: "petit budget, moyen ou haut de gamme", premium: true },
  photo: { label: "Photo", type: "url", aide: "lien de la photo principale", premium: true },
  statut: { label: "Statut", type: "texte", aide: "ouvert, fermé définitivement…" },
  remarques: { label: "Remarques", type: "texte", aide: "services, équipements, description" },
  latitude: { label: "Latitude", type: "nombre", aide: "coordonnée GPS" },
  longitude: { label: "Longitude", type: "nombre", aide: "coordonnée GPS" },
  lien_carte: { label: "Lien carte", type: "url", aide: "fiche Google Maps ou OpenStreetMap" },
  instagram_abonnes: { label: "Abonnés Instagram", type: "nombre", aide: "nombre d'abonnés", premium: true },
  facebook_abonnes: { label: "Abonnés Facebook", type: "nombre", aide: "nombre d'abonnés", premium: true },
};

export const isPlaceField = (v: unknown): v is PlaceField => typeof v === "string" && (PLACE_FIELDS as readonly string[]).includes(v);

/**
 * Champ de lieu choisi explicitement pour une colonne (suggestion ou modèle).
 * Pas de déduction d'après le nom : « statut » d'une école (public/privé) n'est pas le statut d'ouverture d'un lieu.
 */
export const placeFieldOf = (col: { field?: string }): PlaceField | undefined => (isPlaceField(col.field) ? col.field : undefined);
