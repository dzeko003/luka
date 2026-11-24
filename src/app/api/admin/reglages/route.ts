import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { apiConsoleAdmin, jsonError } from "@/lib/api";
import { checkSetting, DEFAULTS, loadSettings, SETTINGS } from "@/lib/settings";

const body = z.object({ values: z.record(z.string(), z.number().nullable()) });

/** Administration : enregistre les réglages modifiés. Une valeur égale au défaut (ou nulle) efface le réglage. */
export async function PUT(req: Request) {
  const admin = await apiConsoleAdmin();
  if (!admin) return jsonError("Introuvable", 404);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Requête invalide");

  const upserts: { key: string; value: number }[] = [];
  const resets: string[] = [];
  for (const [key, raw] of Object.entries(parsed.data.values)) {
    const def = SETTINGS.find((s) => s.key === key);
    if (!def) return jsonError(`Réglage inconnu : ${key}`);
    if (raw === null) {
      resets.push(key);
      continue;
    }
    const v = checkSetting(def, raw);
    if (typeof v === "string") return jsonError(v);
    if (v === DEFAULTS[key]) resets.push(key);
    else upserts.push({ key, value: v });
  }

  await db.transaction(async (tx) => {
    if (resets.length) await tx.delete(schema.settings).where(inArray(schema.settings.key, resets));
    if (upserts.length)
      await tx
        .insert(schema.settings)
        .values(upserts.map((u) => ({ ...u, updatedBy: admin.id, updatedAt: new Date() })))
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: sql`excluded.value`, updatedBy: admin.id, updatedAt: new Date() },
        });
  });
  // Ce processus applique tout de suite ; le travailleur, au plus tard dans 30 secondes
  await loadSettings(true);
  return new Response(null, { status: 204 });
}
