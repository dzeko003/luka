import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";

// Utilisé par Docker (HEALTHCHECK) : l'app répond et la base est joignable
export async function GET() {
  await connection();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
