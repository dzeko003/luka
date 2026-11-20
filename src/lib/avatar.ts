import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Photo de profil contenue dans le jeton d'identité Google (déjà vérifié par Better Auth lors de la connexion). */
export function googlePicture(idToken: string | null | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const { picture } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { picture?: unknown };
    return typeof picture === "string" && /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(picture) ? picture : null;
  } catch {
    return null;
  }
}

/**
 * Reprend la photo Google d'un utilisateur : à l'inscription, mais aussi pour un compte créé par e-mail
 * puis relié à Google, et à chaque connexion (Google change l'adresse de la photo quand elle est modifiée).
 * Une photo qui ne vient pas de Google n'est jamais remplacée.
 */
export async function syncGoogleAvatar(userId: string) {
  const [row] = await db
    .select({ idToken: schema.account.idToken, image: schema.user.image })
    .from(schema.account)
    .innerJoin(schema.user, eq(schema.user.id, schema.account.userId))
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "google")));
  const picture = googlePicture(row?.idToken);
  if (!picture || picture === row.image) return;
  if (row.image && !row.image.includes("googleusercontent.com")) return;
  await db.update(schema.user).set({ image: picture }).where(eq(schema.user.id, userId));
}
