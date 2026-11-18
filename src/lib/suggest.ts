import { z } from "zod";
import type { ColumnDef } from "@/db/schema";
import { isPlaceField, PLACE_CATALOG, PLACE_FIELDS } from "./connectors/places";
import { limits } from "./config";
import { chatJson } from "./llm";

/** Colonnes proposées au maximum par une suggestion (le formulaire en accepte davantage). */
export const MAX_SUGGESTED_COLUMNS = 20;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const columnSchema = z.object({
  name: z.string().trim().min(1).max(40).transform(slug).pipe(z.string().min(1)),
  label: z.string().trim().min(1).max(60),
  type: z.enum(["texte", "nombre", "url", "date", "booleen"]).catch("texte"),
  description: z.string().trim().max(200).optional(),
  // Champ de lieu rempli automatiquement ; une valeur inconnue est simplement ignorée
  field: z
    .unknown()
    .transform((v) => (isPlaceField(v) ? v : undefined))
    .optional(),
});

const catalogText = PLACE_FIELDS.map((f) => {
  const c = PLACE_CATALOG[f];
  return `- ${f} (${c.type}) : ${c.label}, ${c.aide}${c.premium ? " [Premium]" : ""}`;
}).join("\n");

/**
 * L'IA propose un titre et des colonnes adaptées à la demande.
 * Pour les lieux, elle pioche d'abord dans les champs que Luka remplit automatiquement.
 * Les colonnes déjà saisies sont conservées : l'IA ne propose que des compléments.
 */
export async function suggestColumns(userId: string, request: string, existing: ColumnDef[] = [], premium = false) {
  const kept = existing.slice(0, limits.maxColumns);
  const room = Math.min(MAX_SUGGESTED_COLUMNS, limits.maxColumns - kept.length);
  if (room <= 0) return { title: "", columns: [] as ColumnDef[] };

  const existingText = kept.length
    ? `\n\nColonnes déjà choisies (ne les repropose pas, propose seulement des compléments utiles) :\n` +
      kept.map((c) => `- ${c.name} : ${c.label}`).join("\n")
    : "";

  const { data } = await chatJson<{ title?: string; columns?: unknown[] }>(
    [
      {
        role: "system",
        content:
          "Tu aides à concevoir une collecte de données. À partir de la demande, propose un titre court et des " +
          `colonnes utiles et réalistes à trouver (entre 3 et ${room}, sans remplissage inutile). Réponds uniquement en JSON : ` +
          '{"title": "…", "columns": [{"name": "snake_case", "label": "Libellé", "type": "texte|nombre|url|date|booleen", ' +
          '"description": "…", "field": "champ ou null"}]}.\n' +
          "La première colonne doit identifier chaque ligne (ex. le nom).\n\n" +
          "Si la demande porte sur des lieux physiques (établissements, commerces, services, bâtiments…), Luka remplit " +
          "automatiquement les champs ci-dessous depuis les cartes (Google Maps, OpenStreetMap), les sites web et les " +
          "réseaux sociaux. Choisis-les en priorité, indique le champ dans « field » et reprends son nom comme « name ». " +
          "Pense aux coordonnées (latitude, longitude), aux contacts et aux réseaux sociaux quand c'est utile. " +
          (premium
            ? "L'utilisateur a la formule Premium : les champs [Premium] sont disponibles, propose-les quand ils sont utiles " +
              "(note, avis, photo, niveau de prix…) avec leur « field ».\n"
            : "L'utilisateur a la formule gratuite : les champs [Premium] resteront vides, ne les propose que s'ils sont demandés.\n") +
          catalogText +
          "\n\nPour une demande qui ne porte pas sur des lieux, ou pour une colonne qu'aucun champ ne couvre, mets « field » à null.",
      },
      { role: "user", content: request + existingText },
    ],
    { userId, purpose: "suggest" },
    { maxTokens: 4000, temperature: 0.3 },
  );

  const taken = new Set(kept.map((c) => c.name));
  const takenFields = new Set(kept.map((c) => c.field).filter(Boolean));
  const columns: ColumnDef[] = [];
  for (const raw of data.columns ?? []) {
    const parsed = columnSchema.safeParse(raw);
    if (!parsed.success) continue;
    const col = parsed.data;
    if (taken.has(col.name) || (col.field && takenFields.has(col.field))) continue;
    taken.add(col.name);
    if (col.field) takenFields.add(col.field);
    columns.push(col.field ? col : { name: col.name, label: col.label, type: col.type, description: col.description });
    if (columns.length >= room) break;
  }
  return { title: (data.title ?? "").slice(0, 120), columns };
}
