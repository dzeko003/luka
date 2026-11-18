import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getSession } from "./auth";

export const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Utilisateur connecté (et non bloqué) pour les routes API, sinon null. */
export async function apiUser() {
  const s = await getSession();
  if (!s || s.user.blocked) return null;
  return s.user;
}

export async function getOwnedCollecte(id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [c] = await db
    .select()
    .from(schema.collectes)
    .where(and(eq(schema.collectes.id, id), eq(schema.collectes.userId, userId)));
  return c;
}
