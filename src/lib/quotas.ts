import { and, count, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { limits, tierLimits } from "./config";
import { loadSettings } from "./settings";

const startOfDayUtc = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export type QuotaStatus = {
  ok: boolean;
  reason?: string;
  usedToday: number;
  limitPerDay: number;
};

const SUGGESTIONS_PER_DAY = 20;

async function globalLlmCallsToday() {
  const [r] = await db
    .select({ n: count() })
    .from(schema.llmUsage)
    .where(gte(schema.llmUsage.createdAt, startOfDayUtc()));
  return r.n;
}

/** Vérifie toutes les limites avant de lancer une collecte (selon la formule de l'utilisateur). */
export async function checkCollecteQuota(user: { id: string; blocked?: boolean | null; plan?: string | null }): Promise<QuotaStatus> {
  await loadSettings();
  const limitPerDay = tierLimits(user.plan).collectesPerDay;
  const [{ n: usedToday }] = await db
    .select({ n: count() })
    .from(schema.collectes)
    .where(and(eq(schema.collectes.userId, user.id), gte(schema.collectes.createdAt, startOfDayUtc())));

  const base = { usedToday, limitPerDay };
  if (user.blocked) return { ...base, ok: false, reason: "Ton compte est suspendu. Contacte l'administrateur." };
  if (usedToday >= limitPerDay)
    return { ...base, ok: false, reason: `Limite atteinte : ${limitPerDay} collectes par jour. Reviens demain.` };

  const [{ n: running }] = await db
    .select({ n: count() })
    .from(schema.collectes)
    .where(and(eq(schema.collectes.userId, user.id), inArray(schema.collectes.status, ["pending", "running"])));
  if (running >= limits.maxConcurrentPerUser)
    return { ...base, ok: false, reason: "Une collecte est déjà en cours. Attends qu'elle se termine." };

  if ((await globalLlmCallsToday()) >= limits.globalLlmCallsPerDay)
    return { ...base, ok: false, reason: "Luka a atteint sa capacité gratuite du jour. Réessaie demain." };

  return { ...base, ok: true };
}

/** Limite les suggestions de colonnes par l'IA (elles consomment aussi le quota). */
export async function checkSuggestQuota(userId: string): Promise<{ ok: boolean; reason?: string }> {
  await loadSettings();
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.llmUsage)
    .where(
      and(
        eq(schema.llmUsage.userId, userId),
        eq(schema.llmUsage.purpose, "suggest"),
        gte(schema.llmUsage.createdAt, startOfDayUtc()),
      ),
    );
  if (n >= SUGGESTIONS_PER_DAY) return { ok: false, reason: "Limite de suggestions atteinte pour aujourd'hui." };
  if ((await globalLlmCallsToday()) >= limits.globalLlmCallsPerDay)
    return { ok: false, reason: "Luka a atteint sa capacité gratuite du jour." };
  return { ok: true };
}

