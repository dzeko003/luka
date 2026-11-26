import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { apiConsoleAdmin, jsonError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** Retire une fiche de la base Luka (demande de retrait, donnée erronée) ; ses liens partent avec elle. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await apiConsoleAdmin();
  if (!admin) return jsonError("Accès refusé", 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Fiche introuvable", 404);
  const deleted = await db.delete(schema.entities).where(eq(schema.entities.id, id)).returning({ id: schema.entities.id });
  if (!deleted.length) return jsonError("Fiche introuvable", 404);
  return new Response(null, { status: 204 });
}
