import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { captcha, twoFactor } from "better-auth/plugins";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { syncGoogleAvatar } from "./avatar";
import { eq } from "drizzle-orm";
import { clientIp, countryOf } from "./geo";
import { deleteAccountMail, mailEnabled, resetPasswordMail, sendMail, verificationMail } from "./mailer";

const requireVerification = mailEnabled || process.env.NODE_ENV !== "production";

// Captcha Turnstile : seulement si la clé secrète est configurée
const captchaPlugins = process.env.TURNSTILE_SECRET_KEY
  ? [
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: process.env.TURNSTILE_SECRET_KEY,
        endpoints: ["/sign-up/email", "/sign-in/email", "/request-password-reset"],
      }),
    ]
  : [];

/** Connexions comptées dans le journal, selon le chemin qui a ouvert la session. */
function loginMethod(path: string): string | null {
  if (path === "/sign-in/email") return "email";
  if (path.startsWith("/callback/")) return "google";
  if (path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code") return "2fa";
  if (path === "/verify-email") return "lien";
  return null;
}

/** Chemins où une réussite du code à 6 chiffres (ou d'un code de secours) ouvre une session. */
const MFA_PATHS = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code"]);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Compte activé par le lien reçu par e-mail. Sans SMTP en production, l'activation est désactivée
    // pour ne pas bloquer les inscriptions ; en développement, le lien s'affiche dans la console.
    requireEmailVerification: requireVerification,
    resetPasswordTokenExpiresIn: 60 * 60,
    // Après un changement de mot de passe, toutes les sessions ouvertes sont fermées
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      void sendMail({ to: user.email, ...resetPasswordMail(user.name, url) }).catch((e) =>
        console.error(`[mail] échec de l'e-mail de réinitialisation : ${(e as Error).message}`),
      );
    },
    // Le lien reçu par e-mail prouve que l'adresse appartient bien à l'utilisateur
    onPasswordReset: async ({ user }) => {
      if (!user.emailVerified) await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, user.id));
    },
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
  databaseHooks: {
    session: {
      create: {
        // Un compte suspendu par un administrateur ne peut plus ouvrir de session (e-mail ou Google)
        before: async (session) => {
          const [u] = await db.select({ blocked: schema.user.blocked }).from(schema.user).where(eq(schema.user.id, session.userId));
          if (u?.blocked) throw new APIError("FORBIDDEN", { message: "Compte suspendu", code: "ACCOUNT_BLOCKED" });
        },
      },
    },
  },
  session: {
    additionalFields: {
      mfaVerified: { type: "boolean", defaultValue: false, input: false },
    },
  },
  hooks: {
    // La session créée juste après un code Google Authenticator valide est marquée : elle seule ouvre la console.
    // Une connexion Google ou par mot de passe seul ne passe pas par ici.
    after: createAuthMiddleware(async (ctx) => {
      const created = ctx.context.newSession;
      if (!ctx.path || !created) return;
      if (MFA_PATHS.has(ctx.path)) {
        await db.update(schema.session).set({ mfaVerified: true }).where(eq(schema.session.id, created.session.id));
      }
      // Journal des connexions. Ce crochet passe avant celui du plugin twoFactor : une connexion par mot de passe
      // d'un compte protégé n'est comptée qu'après le code. L'activation (déjà connecté) n'est pas une connexion.
      const method = loginMethod(ctx.path);
      if (method === "google") await syncGoogleAvatar(created.user.id).catch((e) => console.error(`[avatar] ${(e as Error).message}`));
      if (!method || ctx.context.session) return;
      if (method === "email" && (created.user as { twoFactorEnabled?: boolean }).twoFactorEnabled) return;
      await db
        .insert(schema.logins)
        .values({ userId: created.user.id, method, country: ctx.headers ? countryOf(clientIp(ctx.headers)) : null })
        .catch((e) => console.error(`[connexions] journal non enregistré : ${(e as Error).message}`));
    }),
  },
  account: {
    // « Mon compte » : relier un compte Google, même avec une autre adresse que celle du compte Luka
    accountLinking: { enabled: true, trustedProviders: ["google"], allowDifferentEmails: true },
  },
  user: {
    // Suppression confirmée par un lien reçu par e-mail (fonctionne aussi pour les comptes Google sans mot de passe)
    deleteUser: {
      enabled: true,
      deleteTokenExpiresIn: 60 * 60,
      sendDeleteAccountVerification: async ({ user, url }) => {
        void sendMail({ to: user.email, ...deleteAccountMail(user.name, url) }).catch((e) =>
          console.error(`[mail] échec de l'e-mail de suppression : ${(e as Error).message}`),
        );
      },
    },
    additionalFields: {
      plan: { type: "string", defaultValue: "free", input: false },
      credits: { type: "number", defaultValue: 0, input: false },
      role: { type: "string", defaultValue: "member", input: false },
      blocked: { type: "boolean", defaultValue: false, input: false },
      // Géré par le plugin twoFactor ; déclaré ici pour le typage de la session
      twoFactorEnabled: { type: "boolean", defaultValue: false, input: false },
    },
  },
  // Limite les tentatives de connexion/inscription par IP
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    // Évite d'inonder une boîte mail de liens
    customRules: { "/request-password-reset": { window: 60, max: 3 }, "/send-verification-email": { window: 60, max: 3 } },
  },
  plugins: [
    ...captchaPlugins,
    // Double authentification (Google Authenticator) : obligatoire pour la console d'administration
    twoFactor({ issuer: "Luka Admin", backupCodeOptions: { amount: 10, length: 10 } }),
    nextCookies(), // doit rester en dernier
  ],
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

/**
 * Console d'administration : rôle admin, double authentification activée, et session ouverte avec
 * le mot de passe puis le code Google Authenticator. Sinon : 404 pour les non-admins, sinon
 * redirection vers la connexion de la console ou vers l'activation de la double authentification.
 */
export async function requireConsoleAdmin(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/admin/connexion");
  const user = s.user;
  if (user.role !== "admin" || user.blocked) notFound();
  if (!user.twoFactorEnabled) redirect("/admin/securite");
  if (!s.session.mfaVerified) redirect("/admin/connexion?session=1");
  return user;
}

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
