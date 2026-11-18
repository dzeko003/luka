import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { apiUser, jsonError } from "@/lib/api";

export async function GET() {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const items = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(20);
  return Response.json({ items, unread: items.filter((n) => !n.read).length });
}

/** Marque toutes les notifications comme lues */
export async function POST() {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  await db
    .update(schema.notifications)
    .set({ read: true })
    .where(and(eq(schema.notifications.userId, user.id), eq(schema.notifications.read, false)));
  return new Response(null, { status: 204 });
}
