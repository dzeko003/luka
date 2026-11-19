import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha } from "better-auth/plugins";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { mailEnabled, sendMail, verificationMail } from "./mailer";

const requireVerification = mailEnabled || process.env.NODE_ENV !== "production";

const plugins = [];
if (process.env.TURNSTILE_SECRET_KEY) {
  plugins.push(
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY,
      endpoints: ["/sign-up/email", "/sign-in/email"],
    }),
  );
}
plugins.push(nextCookies()); // doit rester en dernier

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Compte activé par le lien reçu par e-mail. Sans SMTP en production, l'activation est désactivée
    // pour ne pas bloquer les inscriptions ; en développement, le lien s'affiche dans la console.
    requireEmailVerification: requireVerification,
  },
  emailVerification: {
    sendOnSignUp: requireVerification,
    // Une tentative de connexion d'un compte non activé renvoie un nouveau lien
    sendOnSignIn: requireVerification,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      // Sans attendre l'envoi : la réponse ne doit pas révéler si l'adresse existe
      void sendMail({ to: user.email, ...verificationMail(user.name, url) }).catch((e) =>
        console.error(`[mail] échec de l'e-mail d'activation : ${(e as Error).message}`),
      );
    },
  },
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
  user: {
    additionalFields: {
      plan: { type: "string", defaultValue: "free", input: false },
      credits: { type: "number", defaultValue: 0, input: false },
      role: { type: "string", defaultValue: "member", input: false },
      blocked: { type: "boolean", defaultValue: false, input: false },
    },
  },
  // Limite les tentatives de connexion/inscription par IP
  rateLimit: { enabled: true, window: 60, max: 20 },
  plugins,
});

export type SessionUser = typeof auth.$Infer.Session.user;

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Pour les pages : redirige vers /connexion si non connecté */
export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/connexion");
  return s.user;
}

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
