import { z } from "zod";
import { apiUser, jsonError } from "@/lib/api";
import { checkSuggestQuota } from "@/lib/quotas";
import { limits } from "@/lib/config";
import { columnSchema, suggestColumns } from "@/lib/suggest";

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const parsed = z
    .object({
      request: z.string().trim().min(10, "Décris ta demande en au moins 10 caractères").max(2000),
      // Colonnes déjà saisies : l'IA les garde et propose seulement des compléments
      columns: z.array(columnSchema).max(limits.maxColumns).catch([]).default([]),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Demande invalide");

  const quota = await checkSuggestQuota(user.id);
  if (!quota.ok) return jsonError(quota.reason!, 429);

  try {
    return Response.json(await suggestColumns(user.id, parsed.data.request, parsed.data.columns, user.plan === "premium"));
  } catch (e) {
    return jsonError((e as Error).message, 502);
  }
}
