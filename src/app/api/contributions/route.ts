import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, jsonError } from "@/lib/api";
import { KB_FIELDS, MAX_CONTRIBUTION_ROWS } from "@/lib/kb";
import { isExtraKey, isPersonal } from "@/lib/kb-fields";

/*
 * Contributions : un utilisateur envoie un fichier (CSV, Excel, JSON) pour enrichir la base Luka.
 * Le navigateur lit le fichier et associe chaque colonne à un champ de la base ; rien n'entre dans la base
 * avant la validation de l'administrateur.
 */

const MAX_PENDING = 5;

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]).transform((v) => (v === null ? "" : String(v).trim().slice(0, 500)));

const bodySchema = z.object({
  title: z.string().trim().min(1, "Donne un titre à ta contribution").max(120),
  // Facultatifs : l'origine aide à la vérification ; la ville ne sert qu'aux lignes qui n'en ont pas
  description: z.string().trim().max(1000).default(""),
  city: z.string().trim().max(80).default(""),
  category: z.string().trim().max(80).optional(),
  fileName: z.string().trim().min(1).max(200),
  headers: z.array(z.string().max(200)).min(1).max(80),
  // Pour chaque colonne : un champ de la base, « autre:<nom> » (gardée telle quelle) ou null (retirée)
  mapping: z
    .array(z.string().nullable())
    .min(1)
    .max(80)
    .refine((m) => m.every((t) => t === null || (KB_FIELDS as readonly string[]).includes(t) || isExtraKey(t)), "Colonne mal associée"),
  rows: z.array(z.array(cell)).min(1, "Le fichier ne contient aucune ligne").max(MAX_CONTRIBUTION_ROWS, `${MAX_CONTRIBUTION_ROWS} lignes maximum par fichier`),
  consent: z.literal(true, { message: "Confirme que tu as le droit de partager ces données" }),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  if (!user.emailVerified) return jsonError("Active ton compte (lien reçu par e-mail) avant de contribuer", 403);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Données invalides");
  const { title, description, city, category, fileName, headers, rows } = parsed.data;
  if (headers.length !== parsed.data.mapping.length) return jsonError("Colonnes incohérentes");
  // Une colonne sensible (elle parle d'une personne) est retirée ici aussi, même si elle a été associée à la main
  const mapping = parsed.data.mapping.map((t, i) => (isPersonal(headers[i]) ? null : t));
  if (!mapping.includes("nom")) return jsonError("Indique quelle colonne contient le nom des établissements");
  if (new Set(mapping.filter(Boolean)).size !== mapping.filter(Boolean).length) return jsonError("Deux colonnes sont associées à la même information");

  const records = rows
    .map((r) => {
      const rec: Record<string, string> = {};
      mapping.forEach((f, i) => {
        if (f && r[i]) rec[f] = r[i];
      });
      return rec;
    })
    // Un nom d'établissement est court : une phrase (légende, consigne) n'en est pas un
    .filter((r) => {
      const nom = (r.nom ?? "").trim();
      return nom.length > 1 && nom.length <= 150 && !/^[•\-*]/.test(nom) && nom.split(/\s+/).length <= 15;
    });
  if (!records.length) return jsonError("Aucune ligne n'a de nom d'établissement");

  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.contributions)
    .where(and(eq(schema.contributions.userId, user.id), eq(schema.contributions.status, "pending")));
  if (n >= MAX_PENDING) return jsonError(`Tu as déjà ${MAX_PENDING} contributions en attente de vérification. Patiente un peu.`, 429);

  const [c] = await db
    .insert(schema.contributions)
    .values({ userId: user.id, title, description, city, category: category || null, fileName, rows: records, rowCount: records.length })
    .returning({ id: schema.contributions.id });
  return Response.json({ id: c.id, rows: records.length }, { status: 201 });
}
