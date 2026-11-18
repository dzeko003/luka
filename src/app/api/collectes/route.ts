import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, jsonError } from "@/lib/api";
import { limits, tierLimits } from "@/lib/config";
import { checkCollecteQuota } from "@/lib/quotas";
import { columnSchema } from "@/lib/suggest";

const bodySchema = z.object({
  title: z.string().trim().min(2).max(120),
  request: z.string().trim().min(10, "Décris ta demande en au moins 10 caractères").max(2000),
  columns: z
    .array(columnSchema)
    .min(1, "Ajoute au moins une colonne")
    .max(limits.maxColumns, `${limits.maxColumns} colonnes maximum`)
    .refine((cols) => new Set(cols.map((c) => c.name)).size === cols.length, "Deux colonnes ont le même nom"),
  maxRows: z.coerce.number().int().min(1).max(limits.hardMaxRows).optional(),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Données invalides");

  const quota = await checkCollecteQuota(user);
  if (!quota.ok) return jsonError(quota.reason!, 429);

  const { title, request, columns } = parsed.data;
  // La formule de l'utilisateur (modifiable seulement par l'administrateur) décide des sources et des limites
  const tier = user.plan === "premium" ? "premium" : "free";
  const tierMax = tierLimits(tier).maxRows;
  const maxRows = Math.min(parsed.data.maxRows ?? tierMax, tierMax);

  const [c] = await db
    .insert(schema.collectes)
    .values({ userId: user.id, title, request, columns, maxRows, tier })
    .returning({ id: schema.collectes.id });

  // La collecte attend dans la file : le travailleur (src/lib/worker.ts) la prend en charge

  return Response.json({ id: c.id }, { status: 201 });
}
