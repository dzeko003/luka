/**
 * Modèles de collecte proposés dans la barre latérale et le formulaire.
 * L'icône est un nom de composant lucide-react, résolu côté interface.
 */
export type TemplateColumn = { name: string; label: string; type: string; description?: string; field?: string };

export type Template = {
  id: string;
  label: string;
  icon: "Store" | "MapPin" | "Landmark" | "Building2" | "Briefcase" | "GraduationCap" | "Hospital" | "CalendarDays";
  title: string;
  request: string;
  columns: TemplateColumn[];
};

export const TEMPLATES: Template[] = [
  {
    id: "mon-coin",
    label: "Format Mon Coin",
    icon: "Store",
    title: "Bonnes adresses — format Mon Coin",
    request:
      "Les bonnes adresses de Brazzaville et Pointe-Noire (République du Congo) : restaurants, maquis, fast-foods, cafés, " +
      "bars, lounges, boîtes de nuit, hôtels, plages, sites nature, lieux culturels, marchés et loisirs.",
    // Colonnes de la table public.collecte de Mon Coin (bon-coin/db/moncoin_schema_final.sql), plus les compléments utiles
    columns: [
      { name: "nom", label: "nom", type: "texte", field: "nom" },
      { name: "ville", label: "ville", type: "texte", description: "Brazzaville ou Pointe-Noire", field: "ville" },
      { name: "arrondissement", label: "arrondissement", type: "texte", field: "arrondissement" },
      { name: "quartier", label: "quartier", type: "texte", field: "quartier" },
      { name: "adresse", label: "adresse", type: "texte", description: "rue + repère, 5 caractères minimum", field: "adresse" },
      { name: "repere", label: "repere", type: "texte", description: "point de repère proche (ex. face au marché)" },
      { name: "lat", label: "lat", type: "nombre", field: "latitude" },
      { name: "lng", label: "lng", type: "nombre", field: "longitude" },
      { name: "numero_gerant", label: "numero_gerant", type: "texte", description: "+242…", field: "telephone" },
      { name: "whatsapp", label: "whatsapp", type: "texte", field: "whatsapp" },
      { name: "facebook", label: "facebook", type: "url", field: "facebook" },
      { name: "instagram", label: "instagram", type: "url", field: "instagram" },
      { name: "tiktok", label: "tiktok", type: "url", field: "tiktok" },
      { name: "site_web", label: "site_web", type: "url", field: "site_web" },
      {
        name: "categorie",
        label: "categorie",
        type: "texte",
        description: "restaurant, maquis, fast_food, cafe, bar, lounge, night_club, hotel, beach, nature, culture, market, leisure ou other",
        field: "categorie",
      },
      { name: "niveau_prix", label: "niveau_prix", type: "texte", description: "petit_budget, moyen ou haut_de_gamme", field: "niveau_prix" },
      { name: "photo", label: "photo", type: "url", field: "photo" },
      { name: "description", label: "description", type: "texte", field: "remarques" },
      { name: "horaires", label: "horaires", type: "texte", field: "horaires" },
      { name: "note_google", label: "note_google", type: "nombre", field: "note" },
      { name: "avis_google", label: "avis_google", type: "nombre", field: "nombre_avis" },
      { name: "google_maps", label: "google_maps", type: "url", field: "lien_carte" },
    ],
  },
  {
    id: "lieux",
    label: "Lieux à visiter",
    icon: "MapPin",
    title: "Lieux à visiter à Pointe-Noire",
    request: "Les meilleurs lieux touristiques à visiter à Pointe-Noire (Congo) : plages, monuments, nature, culture.",
    columns: [
      { name: "lieu", label: "Lieu", type: "texte" },
      { name: "categorie", label: "Catégorie", type: "texte", description: "plage, monument, nature, musée…" },
      { name: "adresse", label: "Adresse / quartier", type: "texte" },
      { name: "description", label: "Description", type: "texte", description: "Une phrase" },
    ],
  },
  {
    id: "administrations",
    label: "Administrations",
    icon: "Landmark",
    title: "Arrondissements de Brazzaville",
    request: "Liste des arrondissements de Brazzaville (République du Congo) avec le nom de leur maire actuel.",
    columns: [
      { name: "arrondissement", label: "Arrondissement", type: "texte", description: "Numéro et nom, ex. 1 – Makélékélé" },
      { name: "maire", label: "Maire", type: "texte", description: "Administrateur-maire actuel" },
      { name: "population", label: "Population", type: "nombre" },
    ],
  },
  {
    id: "villes",
    label: "Villes et régions",
    icon: "Building2",
    title: "Villes du Cameroun",
    request: "Les principales villes du Cameroun avec leur région et leur population.",
    columns: [
      { name: "ville", label: "Ville", type: "texte" },
      { name: "region", label: "Région", type: "texte" },
      { name: "population", label: "Population", type: "nombre" },
    ],
  },
  {
    id: "entreprises",
    label: "Entreprises",
    icon: "Briefcase",
    title: "Entreprises de télécoms au Congo",
    request: "Les opérateurs et entreprises de télécommunications présents en République du Congo, avec leur site web.",
    columns: [
      { name: "entreprise", label: "Entreprise", type: "texte" },
      { name: "secteur", label: "Activité", type: "texte" },
      { name: "ville", label: "Siège", type: "texte" },
      { name: "site_web", label: "Site web", type: "url" },
    ],
  },
  {
    id: "ecoles",
    label: "Écoles et universités",
    icon: "GraduationCap",
    title: "Universités de Brazzaville",
    request: "Les universités et grandes écoles publiques et privées de Brazzaville.",
    columns: [
      { name: "etablissement", label: "Établissement", type: "texte" },
      { name: "statut", label: "Public / privé", type: "texte" },
      { name: "adresse", label: "Adresse / quartier", type: "texte" },
      { name: "site_web", label: "Site web", type: "url" },
    ],
  },
  {
    id: "sante",
    label: "Santé",
    icon: "Hospital",
    title: "Hôpitaux de Brazzaville",
    request: "Les hôpitaux et cliniques de Brazzaville avec leur adresse et leur numéro de téléphone public.",
    columns: [
      { name: "etablissement", label: "Établissement", type: "texte" },
      { name: "type", label: "Type", type: "texte", description: "hôpital, clinique, CSI…" },
      { name: "adresse", label: "Adresse / quartier", type: "texte" },
      { name: "telephone", label: "Téléphone", type: "texte" },
    ],
  },
  {
    id: "evenements",
    label: "Événements",
    icon: "CalendarDays",
    title: "Festivals au Congo",
    request: "Les grands festivals culturels organisés en République du Congo, avec leur ville et leur période.",
    columns: [
      { name: "evenement", label: "Événement", type: "texte" },
      { name: "ville", label: "Ville", type: "texte" },
      { name: "periode", label: "Période", type: "texte", description: "mois ou dates habituelles" },
      { name: "site_web", label: "Site web", type: "url" },
    ],
  },
];

export const getTemplate = (id: string | undefined | null) => TEMPLATES.find((t) => t.id === id);
