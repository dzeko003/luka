import { and, eq, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { apiUser, getOwnedCollecte, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** La collecte et le décompte de ses lignes par statut (les lignes elles-mêmes : ./rows, paginées). */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) return jsonError("Collecte introuvable", 404);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      valide: sql<number>`count(*) filter (where ${schema.rows.status} = 'valide')`.mapWith(Number),
      a_verifier: sql<number>`count(*) filter (where ${schema.rows.status} = 'a_verifier')`.mapWith(Number),
      rejete: sql<number>`count(*) filter (where ${schema.rows.status} = 'rejete')`.mapWith(Number),
    })
    .from(schema.rows)
    .where(eq(schema.rows.collecteId, c.id));

  let queuePosition: number | null = null;
  if (c.status === "pending") {
    const [q] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.collectes)
      // lt() convertit la date pour le pilote postgres (une Date brute dans sql`` le fait planter)
      .where(and(eq(schema.collectes.status, "pending"), lt(schema.collectes.createdAt, c.createdAt)));
    queuePosition = q.n + 1;
  }
  // Le fichier importé (enrichissement) peut être lourd et n'est pas affiché : il ne part pas avec chaque rafraîchissement
  const { input, ...collecte } = c;
  return Response.json({ collecte: { ...collecte, inputRows: input?.length ?? null }, counts, queuePosition });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) return jsonError("Collecte introuvable", 404);
  if (c.status === "running") return jsonError("Attends la fin de la collecte");
  // Une collecte encore dans la file peut être annulée : elle est simplement supprimée
  await db.delete(schema.collectes).where(eq(schema.collectes.id, c.id));
  return new Response(null, { status: 204 });
}
