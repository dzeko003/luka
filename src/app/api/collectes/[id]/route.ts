import { and, count, eq, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, getOwnedCollecte, jsonError } from "@/lib/api";
import { ingestLater } from "@/lib/kb";
import { isFrequency, nextRefreshDate, REFRESH_LABELS, refreshRules } from "@/lib/refresh";

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
  const refreshOptions = refreshRules(user.plan).frequencies;
  return Response.json({ collecte: { ...collecte, inputRows: input?.length ?? null }, counts, queuePosition, refreshOptions });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) return jsonError("Collecte introuvable", 404);
  if (c.status === "running" || c.refreshing) return jsonError("Attends la fin de la collecte");
  // Une collecte encore dans la file peut être annulée : elle est simplement supprimée
  await db.delete(schema.collectes).where(eq(schema.collectes.id, c.id));
  return new Response(null, { status: 204 });
}

const patchSchema = z.union([z.object({ refresh: z.enum(["aucune", "hebdo", "mensuelle"]) }), z.object({ shareData: z.boolean() })]);

/** Réglages de la collecte : mise à jour automatique (selon la formule) ou partage avec la base Luka. */
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) return jsonError("Collecte introuvable", 404);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Données invalides");
  if ("shareData" in parsed.data) {
    const { shareData } = parsed.data;
    await db.update(schema.collectes).set({ shareData }).where(eq(schema.collectes.id, c.id));
    // Les lignes déjà validées rejoignent la base dès l'accord
    if (shareData) ingestLater(c.id);
    return Response.json({ shareData });
  }
  const { refresh } = parsed.data;

  if (!isFrequency(refresh)) {
    await db.update(schema.collectes).set({ refresh, nextRefreshAt: null }).where(eq(schema.collectes.id, c.id));
    return Response.json({ refresh, nextRefreshAt: null });
  }
  if (c.status !== "done" && !c.refreshing) return jsonError("La mise à jour automatique se règle une fois la collecte terminée");
  const rules = refreshRules(user.plan);
  if (!rules.frequencies.includes(refresh))
    return jsonError(`Avec ta formule, la mise à jour automatique est possible ${rules.frequencies.map((f) => REFRESH_LABELS[f]).join(" ou ")}. Premium permet chaque semaine.`, 403);
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.collectes)
    .where(and(eq(schema.collectes.userId, user.id), ne(schema.collectes.refresh, "aucune"), ne(schema.collectes.id, c.id)));
  if (n >= rules.maxFollowed)
    return jsonError(
      `Ta formule permet de suivre ${rules.maxFollowed} collecte(s) à la fois. Désactive la mise à jour d'une autre collecte${user.plan === "premium" ? "" : ", ou passe en Premium (10 collectes suivies)"}.`,
      403,
    );
  // L'échéance part de la dernière exécution : changer de fréquence ne relance pas tout de suite
  const nextRefreshAt = nextRefreshDate(refresh, c.lastRefreshAt ?? c.finishedAt ?? new Date());
  const due = nextRefreshAt < new Date() ? nextRefreshDate(refresh) : nextRefreshAt;
  await db.update(schema.collectes).set({ refresh, nextRefreshAt: due }).where(eq(schema.collectes.id, c.id));
  return Response.json({ refresh, nextRefreshAt: due });
}
