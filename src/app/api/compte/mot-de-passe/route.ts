import { headers } from "next/headers";
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/api";
import { auth } from "@/lib/auth";

/** Crée un mot de passe pour un compte qui n'en a pas (inscription avec Google). */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const parsed = z.object({ newPassword: z.string().min(8).max(128) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Le mot de passe doit faire au moins 8 caractères.");
  try {
    await auth.api.setPassword({ body: { newPassword: parsed.data.newPassword }, headers: await headers() });
  } catch (e) {
    const code = (e as { body?: { code?: string } }).body?.code;
    return jsonError(code === "PASSWORD_ALREADY_SET" ? "Ton compte a déjà un mot de passe." : "La création du mot de passe a échoué.");
  }
  return Response.json({ ok: true });
}
