import { db, schema } from "@/db";

export async function notify(userId: string, n: { title: string; body?: string; href?: string }) {
  await db.insert(schema.notifications).values({ userId, ...n });
}
