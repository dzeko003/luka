import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, jsonError } from "@/lib/api";

/**
 * Partage des lignes validées avec la base Luka : réglage par défaut des prochaines collectes.
 * Le refus s'applique aussi aux collectes existantes ; l'accord ne les change pas (chacune se règle à part).
 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const parsed = z.object({ shareData: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Données invalides");
  const { shareData } = parsed.data;
  await db.update(schema.user).set({ shareData }).where(eq(schema.user.id, user.id));
  if (!shareData) await db.update(schema.collectes).set({ shareData: false }).where(eq(schema.collectes.userId, user.id));
  return Response.json({ shareData });
}
