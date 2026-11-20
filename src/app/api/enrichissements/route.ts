import { z } from "zod";
import { db, schema } from "@/db";
import type { ColumnDef } from "@/db/schema";
import { apiUser, jsonError } from "@/lib/api";
import { limits, tierLimits } from "@/lib/config";
import { checkCollecteQuota } from "@/lib/quotas";
import { columnSchema } from "@/lib/suggest";

/*
 * Enrichissement d'un fichier : le navigateur lit le fichier (CSV ou Excel) et envoie ses lignes.
 * Les colonnes du fichier sont gardées telles quelles ; celle qui identifie la ligne passe en premier.
 */
const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]).transform((v) => (v === null ? "" : String(v).trim().slice(0, 500)));

const bodySchema = z.object({
  title: z.string().trim().min(2).max(120),
  request: z.string().trim().min(5, "Dis en quelques mots ce que contient le fichier").max(2000),
  fileColumns: z.array(z.string().trim().min(1).max(60)).min(1).max(limits.maxColumns),
  keyColumn: z.number().int().min(0),
  rows: z.array(z.array(cell)).min(1, "Le fichier ne contient aucune ligne").max(limits.maxImportRows, `${limits.maxImportRows} lignes maximum par fichier`),
  columns: z.array(columnSchema).min(1, "Choisis au moins une colonne à compléter").max(limits.maxColumns),
});

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "colonne";

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Données invalides");
  const { title, request, fileColumns, keyColumn, rows, columns } = parsed.data;
  if (keyColumn >= fileColumns.length) return jsonError("Colonne d'identification inconnue");
  if (fileColumns.length + columns.length > limits.maxColumns) return jsonError(`${limits.maxColumns} colonnes maximum au total`);

  // Colonnes du fichier (noms uniques), celle qui identifie la ligne en premier
  const used = new Set<string>();
  const unique = (base: string) => {
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}_${i}`;
    used.add(name);
    return name;
  };
  const order = [keyColumn, ...fileColumns.map((_, i) => i).filter((i) => i !== keyColumn)];
  const fileDefs = order.map((i) => ({ index: i, def: { name: unique(slug(fileColumns[i]).slice(0, 40)), label: fileColumns[i], type: "texte", fromFile: true } as ColumnDef }));
  const newDefs: ColumnDef[] = columns.map((c) => ({ ...c, name: unique(c.name), fromFile: undefined }));

  const input = rows
    .map((r) => Object.fromEntries(fileDefs.map(({ index, def }) => [def.name, r[index] ?? ""])))
    .filter((r) => r[fileDefs[0].def.name]);
  if (!input.length) return jsonError(`La colonne « ${fileColumns[keyColumn]} » est vide sur toutes les lignes`);

  const quota = await checkCollecteQuota(user);
  if (!quota.ok) return jsonError(quota.reason!, 429);

  const tier = user.plan === "premium" ? "premium" : "free";
  const maxRows = Math.min(input.length, tierLimits(tier).maxEnrichRows);

  const [c] = await db
    .insert(schema.collectes)
    .values({ userId: user.id, title, request, columns: [...fileDefs.map((f) => f.def), ...newDefs], maxRows, tier, kind: "enrichissement", input })
    .returning({ id: schema.collectes.id });

  return Response.json({ id: c.id, rows: input.length, maxRows }, { status: 201 });
}
