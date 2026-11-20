import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["a_verifier", "valide", "rejete"]).optional(),
  data: z.record(z.string(), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])).optional(),
});

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Ligne introuvable", 404);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Données invalides");

  const [found] = await db
    .select({ row: schema.rows, columns: schema.collectes.columns })
    .from(schema.rows)
    .innerJoin(schema.collectes, eq(schema.rows.collecteId, schema.collectes.id))
    .where(and(eq(schema.rows.id, id), eq(schema.collectes.userId, user.id)));
  if (!found) return jsonError("Ligne introuvable", 404);

  const update: Partial<typeof schema.rows.$inferInsert> = {};
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.data) {
    const allowed = new Set(found.columns.map((c) => c.name));
    const data = { ...found.row.data };
    const edited = new Set(found.row.edited);
    for (const [k, v] of Object.entries(parsed.data.data))
      if (allowed.has(k)) {
        data[k] = v;
        edited.add(k);
      }
    update.data = data;
    // Une case corrigée à la main n'est plus jamais écrasée par une mise à jour automatique
    update.edited = [...edited];
  }
  if (!Object.keys(update).length) return jsonError("Rien à modifier");

  const [row] = await db.update(schema.rows).set(update).where(eq(schema.rows.id, id)).returning();
  return Response.json({ row });
}
