import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, jsonError } from "@/lib/api";
import { KB_FIELDS, type KbField, MAX_CONTRIBUTION_ROWS } from "@/lib/kb";

/*
 * Contributions : un utilisateur envoie un fichier (CSV, Excel, JSON) pour enrichir la base Luka.
 * Le navigateur lit le fichier et associe chaque colonne à un champ de la base ; rien n'entre dans la base
 * avant la validation de l'administrateur.
 */

const MAX_PENDING = 5;

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]).transform((v) => (v === null ? "" : String(v).trim().slice(0, 500)));

const bodySchema = z.object({
  title: z.string().trim().min(3, "Donne un titre à ta contribution").max(120),
  description: z.string().trim().min(10, "Dis en une phrase ce que contient le fichier et d'où viennent les données").max(1000),
  city: z.string().trim().min(2, "Indique la ville concernée").max(80),
  category: z.string().trim().max(80).optional(),
  fileName: z.string().trim().min(1).max(200),
  mapping: z.array(z.enum(KB_FIELDS).nullable()).min(1).max(60),
  rows: z.array(z.array(cell)).min(1, "Le fichier ne contient aucune ligne").max(MAX_CONTRIBUTION_ROWS, `${MAX_CONTRIBUTION_ROWS} lignes maximum par fichier`),
  consent: z.literal(true, { message: "Confirme que tu as le droit de partager ces données" }),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  if (!user.emailVerified) return jsonError("Active ton compte (lien reçu par e-mail) avant de contribuer", 403);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Données invalides");
  const { title, description, city, category, fileName, mapping, rows } = parsed.data;
  if (!mapping.includes("nom")) return jsonError("Indique quelle colonne contient le nom des établissements");
  if (new Set(mapping.filter(Boolean)).size !== mapping.filter(Boolean).length) return jsonError("Deux colonnes sont associées à la même information");

  const records = rows
    .map((r) => {
      const rec: Partial<Record<KbField, string>> = {};
      mapping.forEach((f, i) => {
        if (f && r[i]) rec[f] = r[i];
      });
      return rec as Record<string, string>;
    })
    .filter((r) => (r.nom ?? "").length > 1);
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
