/**
 * Un connecteur fournit des « documents » (texte + source) à partir d'une requête.
 * L'IA extrait ensuite les lignes de ces documents selon le schéma de la collecte.
 * Pour ajouter une source (Wikidata, OSM, fichier importé…), créer un nouveau
 * connecteur qui respecte cette interface et l'enregistrer dans ./index.ts.
 */

export type SourceDocument = {
  url: string | null; // null = connaissances du modèle (à vérifier)
  title: string;
  content: string;
};

export interface Connector {
  id: string;
  label: string;
  isAvailable(): boolean;
  search(query: string, opts: { maxResults: number; maxChars: number }): Promise<SourceDocument[]>;
}
