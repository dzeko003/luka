import { asc, count } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, getOwnedCollecte, jsonError } from "@/lib/api";
import { ROW_STATUSES, rowsWhere } from "@/lib/rows-query";

type Ctx = { params: Promise<{ id: string }> };

/** Une page de lignes : ?page=1&size=50&statut=valide&q=hotel */
export async function GET(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) return jsonError("Collecte introuvable", 404);

  const sp = new URL(req.url).searchParams;
  const size = Math.min(Math.max(Number(sp.get("size")) || 50, 10), 200);
  const page = Math.max(Number(sp.get("page")) || 1, 1);
  const where = rowsWhere(c.id, { status: sp.get("statut"), q: sp.get("q") });

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: count() }).from(schema.rows).where(where),
    db
      .select()
      .from(schema.rows)
      .where(where)
      .orderBy(asc(schema.rows.position))
      .limit(size)
      .offset((page - 1) * size),
  ]);
  return Response.json({ rows, total, page, size });
}

const bulkSchema = z.object({
  status: z.enum(ROW_STATUSES),
  filtre: z.object({ statut: z.string().nullish(), q: z.string().max(100).nullish() }).default({}),
});

/** Action groupée : change le statut de toutes les lignes qui correspondent au filtre. */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) return jsonError("Collecte introuvable", 404);
  if (c.status === "running" || c.status === "pending") return jsonError("Attends la fin de la collecte");

  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Données invalides");
  const { status, filtre } = parsed.data;
  const updated = await db
    .update(schema.rows)
    .set({ status })
    .where(rowsWhere(c.id, { status: filtre.statut, q: filtre.q }))
    .returning({ id: schema.rows.id });
  return Response.json({ updated: updated.length });
}
