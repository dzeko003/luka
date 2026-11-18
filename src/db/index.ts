import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante (voir .env.example)");

// Une seule connexion réutilisée en dev (rechargements à chaud)
const globalForDb = globalThis as unknown as { lukaSql?: ReturnType<typeof postgres> };
// prepare: false → compatible avec le pooler Supabase (mode transaction)
const sql = globalForDb.lukaSql ?? postgres(url, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.lukaSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
