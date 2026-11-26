import type { ColumnDef } from "@/db/schema";

/*
 * Examen de Luka : de vraies demandes, dans tous les secteurs, et ce qu'une bonne réponse doit contenir.
 * Les attentes ne portent que sur des faits stables (noms connus, sources attendues) : une bonne réponse
 * peut contenir bien plus, mais pas moins.
 */

export type Forme =
  | "lieux"
  | "publications"
  | "organisations"
  | "personnes"
  | "statistiques"
  | "evenements"
  | "textes"
  | "produits"
  | "culture";

export type Attentes = {
  /** Nombre minimum de lignes. */
  minLignes: number;
  /** Texte présent dans la source d'au moins une ligne (ex. « OpenAlex », « OpenStreetMap »). */
  source?: string;
  /** Colonne → part minimale des lignes où elle est remplie (0,8 = 80 %). */
  remplies?: Record<string, number>;
  /** Chaque entrée doit apparaître dans au moins une ligne ; « A|B » accepte l'un ou l'autre. Accents et majuscules ignorés. */
  contient?: string[];
};

export type Cas = {
  id: string;
  forme: Forme;
  secteur: string;
  demande: string;
  colonnes: ColumnDef[];
  attentes: Attentes;
  /** Lignes demandées (10 par défaut : assez pour juger, sans épuiser les quotas). */
  maxLignes?: number;
};

const col = (name: string, label: string, type: ColumnDef["type"] = "texte"): ColumnDef => ({ name, label, type });
const nom = col("nom", "Nom");

export const CAS: Cas[] = [
  /* ---------------------------- Lieux ---------------------------- */
  {
    id: "pharmacies-brazzaville",
    forme: "lieux",
    secteur: "santé",
    demande: "Pharmacies à Brazzaville",
    colonnes: [nom, col("telephone", "Téléphone"), col("quartier", "Quartier")],
    attentes: { minLignes: 8, source: "OpenStreetMap", remplies: { nom: 1 } },
  },
  {
    id: "universites-brazzaville",
    forme: "lieux",
    secteur: "éducation",
    demande: "Universités et instituts d'enseignement supérieur à Brazzaville",
    colonnes: [nom, col("adresse", "Adresse"), col("site_web", "Site web", "url")],
    attentes: { minLignes: 3, contient: ["Marien Ngouabi"], remplies: { nom: 1 } },
  },
  {
    id: "hotels-pointe-noire",
    forme: "lieux",
    secteur: "tourisme",
    demande: "Hôtels à Pointe-Noire",
    colonnes: [nom, col("telephone", "Téléphone"), col("adresse", "Adresse")],
    attentes: { minLignes: 6, source: "OpenStreetMap", remplies: { nom: 1 } },
  },
  {
    id: "marches-brazzaville",
    forme: "lieux",
    secteur: "commerce",
    demande: "Marchés de Brazzaville",
    colonnes: [nom, col("quartier", "Quartier")],
    attentes: { minLignes: 3, contient: ["Total"], remplies: { nom: 1 } },
  },

  /* ------------------------- Publications ------------------------- */
  {
    id: "publications-geographie",
    forme: "publications",
    secteur: "géographie",
    demande: "Les dernières publications en géographie de chercheurs de la République du Congo",
    colonnes: [col("titre", "Titre"), col("auteurs", "Auteurs"), col("institution", "Institution"), col("date", "Date de publication", "date"), col("lien", "Lien", "url")],
    attentes: { minLignes: 8, source: "OpenAlex", remplies: { titre: 1, auteurs: 0.9, date: 0.9 } },
  },
  {
    id: "publications-manioc",
    forme: "publications",
    secteur: "agronomie",
    demande: "Publications scientifiques sur le manioc au Congo",
    colonnes: [col("titre", "Titre"), col("auteurs", "Auteurs"), col("annee", "Année", "nombre"), col("revue", "Revue")],
    attentes: { minLignes: 8, source: "OpenAlex", contient: ["manioc|cassava"], remplies: { titre: 1 } },
  },
  {
    id: "publications-paludisme",
    forme: "publications",
    secteur: "médecine",
    demande: "Articles de recherche sur le paludisme en République du Congo depuis 2020",
    colonnes: [col("titre", "Titre"), col("auteurs", "Auteurs"), col("date", "Date", "date"), col("doi", "DOI")],
    attentes: { minLignes: 8, source: "OpenAlex", contient: ["malaria|paludisme|plasmodium"], remplies: { titre: 1, date: 0.9 } },
  },
  {
    id: "publications-informatique",
    forme: "publications",
    secteur: "informatique",
    demande: "Publications en informatique de chercheurs congolais (Congo-Brazzaville)",
    colonnes: [col("titre", "Titre"), col("auteurs", "Auteurs"), col("annee", "Année", "nombre")],
    attentes: { minLignes: 5, source: "OpenAlex", remplies: { titre: 1 } },
  },
  {
    id: "publications-histoire",
    forme: "publications",
    secteur: "histoire",
    demande: "Travaux de recherche en histoire sur le Congo-Brazzaville",
    colonnes: [col("titre", "Titre"), col("auteurs", "Auteurs"), col("annee", "Année", "nombre"), col("revue", "Revue")],
    attentes: { minLignes: 5, source: "OpenAlex", remplies: { titre: 1 } },
  },

  /* ------------------------- Organisations ------------------------ */
  {
    id: "operateurs-mobile",
    forme: "organisations",
    secteur: "télécoms",
    demande: "Opérateurs de téléphonie mobile en République du Congo",
    colonnes: [nom, col("site_web", "Site web", "url")],
    attentes: { minLignes: 2, contient: ["MTN", "Airtel"] },
  },
  {
    id: "banques-congo",
    forme: "organisations",
    secteur: "finance",
    demande: "Banques commerciales en République du Congo",
    colonnes: [nom, col("siege", "Siège"), col("site_web", "Site web", "url")],
    attentes: { minLignes: 5, contient: ["BGFI", "Ecobank", "LCB|Congolaise de Banque"] },
  },
  {
    id: "ong-environnement",
    forme: "organisations",
    secteur: "environnement",
    demande: "ONG de protection de l'environnement et de la faune actives en République du Congo",
    colonnes: [nom, col("domaine", "Domaine d'action"), col("site_web", "Site web", "url")],
    attentes: { minLignes: 4, contient: ["WCS|Wildlife Conservation Society|WWF|Aspinall|PPG"] },
  },
  {
    id: "clubs-football",
    forme: "organisations",
    secteur: "sport",
    demande: "Clubs de football de première division au Congo-Brazzaville",
    colonnes: [nom, col("ville", "Ville")],
    attentes: { minLignes: 6, contient: ["Diables Noirs", "CARA", "Léopards|Leopards"] },
  },
  {
    id: "ecoles-ingenieurs",
    forme: "organisations",
    secteur: "éducation",
    demande: "Écoles d'ingénieurs et écoles polytechniques au Congo-Brazzaville",
    colonnes: [nom, col("ville", "Ville"), col("site_web", "Site web", "url")],
    attentes: { minLignes: 2, contient: ["ENSP|Polytechnique"] },
  },

  /* --------------------------- Personnes -------------------------- */
  {
    id: "presidents-congo",
    forme: "personnes",
    secteur: "politique",
    demande: "Présidents de la République du Congo depuis l'indépendance",
    colonnes: [nom, col("debut", "Début du mandat"), col("fin", "Fin du mandat")],
    attentes: { minLignes: 5, contient: ["Youlou", "Massamba", "Lissouba", "Sassou"] },
  },
  {
    id: "chercheurs-agronomie",
    forme: "personnes",
    secteur: "agronomie",
    demande: "Chercheurs en agronomie rattachés à l'Université Marien Ngouabi",
    colonnes: [nom, col("discipline", "Discipline"), col("institution", "Institution")],
    attentes: { minLignes: 3, contient: ["Marien Ngouabi"] },
  },

  /* ------------------------- Statistiques ------------------------- */
  {
    id: "population-congo",
    forme: "statistiques",
    secteur: "démographie",
    demande: "Population de la République du Congo par année de 2015 à 2023",
    colonnes: [col("annee", "Année", "nombre"), col("population", "Population", "nombre")],
    attentes: { minLignes: 7, contient: ["2015", "2020", "2023"], remplies: { population: 1 } },
  },
  {
    id: "production-manioc",
    forme: "statistiques",
    secteur: "agronomie",
    demande: "Production annuelle de manioc en République du Congo (tonnes), selon la FAO",
    colonnes: [col("annee", "Année", "nombre"), col("production", "Production (tonnes)", "nombre")],
    attentes: { minLignes: 5, remplies: { production: 1 } },
  },

  /* --------------------------- Événements -------------------------- */
  {
    id: "fespam",
    forme: "evenements",
    secteur: "culture",
    demande: "Éditions du FESPAM (Festival panafricain de musique) à Brazzaville",
    colonnes: [col("edition", "Édition"), col("annee", "Année", "nombre"), col("theme", "Thème")],
    attentes: { minLignes: 4, contient: ["2019|2023|2025"] },
  },

  /* ------------------------ Textes officiels ----------------------- */
  {
    id: "loi-donnees-personnelles",
    forme: "textes",
    secteur: "droit",
    demande: "Lois sur la protection des données personnelles et le numérique en République du Congo",
    colonnes: [col("titre", "Titre du texte"), col("numero", "Numéro"), col("date", "Date")],
    attentes: { minLignes: 1, contient: ["2019"] },
  },

  /* ------------------------ Produits et prix ----------------------- */
  {
    id: "forfaits-mtn",
    forme: "produits",
    secteur: "télécoms",
    demande: "Forfaits internet mobile de MTN Congo et leurs prix",
    colonnes: [col("forfait", "Forfait"), col("volume", "Volume de données"), col("prix", "Prix (FCFA)", "nombre"), col("validite", "Validité")],
    attentes: { minLignes: 3, contient: ["MTN"], remplies: { prix: 0.8 } },
  },

  /* ---------------------------- Culture ---------------------------- */
  {
    id: "rumba-artistes",
    forme: "culture",
    secteur: "musique",
    demande: "Artistes et orchestres célèbres de la rumba congolaise originaires de Brazzaville",
    colonnes: [nom, col("type", "Artiste ou groupe"), col("periode", "Période d'activité")],
    attentes: { minLignes: 5, contient: ["Bantous|Franklin Boukaka|Youlou Mabiala|Pamelo|Kosmos Moutouari"] },
  },
  {
    id: "patrimoine-unesco",
    forme: "culture",
    secteur: "patrimoine",
    demande: "Sites de la République du Congo inscrits au patrimoine mondial de l'UNESCO",
    colonnes: [nom, col("annee", "Année d'inscription", "nombre"), col("type", "Type de site")],
    attentes: { minLignes: 2, contient: ["Sangha", "Odzala"] },
  },
];
