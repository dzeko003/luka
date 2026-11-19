import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiUser, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const body = z
  .object({ plan: z.enum(["free", "premium"]).optional(), blocked: z.boolean().optional() })
  .refine((b) => b.plan !== undefined || b.blocked !== undefined);

/** Administration : changer la formule d'un utilisateur, le suspendre ou le réactiver. */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await apiUser();
  if (!admin || admin.role !== "admin") return jsonError("Introuvable", 404);
  const { id } = await params;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Requête invalide");
  if (id === admin.id && parsed.data.blocked) return jsonError("Tu ne peux pas suspendre ton propre compte.");

  const [updated] = await db
    .update(schema.user)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(schema.user.id, id))
    .returning({ id: schema.user.id, plan: schema.user.plan, blocked: schema.user.blocked });
  if (!updated) return jsonError("Utilisateur introuvable", 404);
  // Suspendu : toutes ses sessions sont fermées tout de suite
  if (parsed.data.blocked) await db.delete(schema.session).where(eq(schema.session.userId, id));
  return Response.json(updated);
}
