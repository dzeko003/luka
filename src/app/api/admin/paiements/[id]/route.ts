import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { apiConsoleAdmin, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Administration : supprimer un paiement saisi par erreur. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await apiConsoleAdmin();
  if (!admin) return jsonError("Introuvable", 404);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Paiement introuvable", 404);
  const [deleted] = await db.delete(schema.payments).where(eq(schema.payments.id, id)).returning({ id: schema.payments.id });
  if (!deleted) return jsonError("Paiement introuvable", 404);
  return new Response(null, { status: 204 });
}
