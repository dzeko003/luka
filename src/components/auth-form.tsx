"use client";

import { Eye, EyeOff, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { captchaErrorMessage, Turnstile, turnstileSiteKey } from "./turnstile";

const input =
  "h-12 w-full rounded-xl border border-(--line) bg-white px-4 text-[15px] text-(--ink) outline-none transition placeholder:text-[#a3a6b1] focus:border-(--violet) focus:ring-4 focus:ring-[#5e0aff]/10";
const label = "mb-1.5 block text-[14px] font-medium";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

/** Message pour le code d'erreur renvoyé dans l'URL (connexion Google ou lien d'activation). */
function authErrorMessage(code: string) {
  const c = code.toLowerCase();
  if (c === "token_expired" || c === "invalid_token") {
    return "Ce lien d'activation a expiré ou a déjà servi. Connecte-toi : on t'enverra un nouveau lien si ton compte n'est pas encore activé.";
  }
  if (c === "user_not_found") return "Aucun compte ne correspond à ce lien d'activation. Crée ton compte à nouveau.";
  if (c.includes("access_denied")) return "Connexion avec Google annulée.";
  if (c.includes("link") || c.includes("email_doesn")) {
    return "Ce compte Google n'a pas pu être relié à un compte existant. Connecte-toi avec ton email et ton mot de passe.";
  }
  if (c.includes("blocked") || c.includes("banned")) return "Ton compte est suspendu. Contacte l'administrateur.";
  return "La connexion avec Google a échoué. Réessaie, ou utilise ton email.";
}

export function AuthForm({
  mode,
  googleEnabled,
  defaultEmail,
  next = "/tableau-de-bord",
  authError,
  notice,
}: {
  mode: "connexion" | "inscription";
  googleEnabled: boolean;
  defaultEmail?: string;
  /** Page où aller après la connexion (chemin interne uniquement). */
  next?: string;
  /** Code d'erreur reçu dans l'URL (paramètre « error ») : connexion Google ou lien d'activation. */
  authError?: string;
  /** Message de confirmation affiché au-dessus du formulaire (ex. mot de passe modifié). */
  notice?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(authError ? authErrorMessage(authError) : null);
  // Adresse en attente d'activation : on affiche « vérifie ta boîte mail » à la place du formulaire
  const [pending, setPending] = useState<{ email: string; reason: "signup" | "signin" } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/tableau-de-bord";
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const isSignUp = mode === "inscription";
  // Garde la demande tapée sur l'accueil quand on passe d'un écran à l'autre
  const keptQuery = next.startsWith("/collectes/nouvelle?") ? next.slice("/collectes/nouvelle".length) : "";
  const switchHref = `${isSignUp ? "/connexion" : "/inscription"}${keptQuery}`;
  // Après le clic sur le lien d'activation : connexion automatique, puis la page de connexion renvoie vers la suite
  const verifyCallback = `/connexion${keptQuery}`;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!pending || cooldown > 0) return;
    setCooldown(60);
    setResent(false);
    const { error } = await authClient.sendVerificationEmail({ email: pending.email, callbackURL: verifyCallback });
    if (error) {
      setError(error.status === 429 ? "Trop de demandes. Réessaie dans une minute." : "L'envoi a échoué. Réessaie dans un instant.");
    } else setResent(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (turnstileSiteKey && !captcha) return setError("Valide le captcha avant de continuer.");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const fetchOptions = captcha ? { headers: { "x-captcha-response": captcha } } : undefined;

    setLoading(true);
    const { data, error } = isSignUp
      ? await authClient.signUp.email({ name: String(form.get("name")), email, password, callbackURL: verifyCallback, fetchOptions })
      : await authClient.signIn.email({ email, password, callbackURL: verifyCallback, fetchOptions });
    setLoading(false);
    // Le jeton du captcha vient d'être consommé : nouveau jeton pour la prochaine tentative
    if (captcha) setCaptchaReset((n) => n + 1);

    if (error?.code === "EMAIL_NOT_VERIFIED") {
      // Le serveur vient de renvoyer un lien d'activation
      setPending({ email, reason: "signin" });
      setCooldown(60);
      return;
    }
    if (error) {
      setError(
        error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Email ou mot de passe incorrect."
          : error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "Un compte existe déjà avec cet email."
            : error.code === "ACCOUNT_BLOCKED"
              ? "Ton compte est suspendu. Contacte l'administrateur."
              : error.status === 429
                ? "Trop de tentatives. Réessaie dans une minute."
                : (captchaErrorMessage(error.code) ?? error.message ?? "Une erreur est survenue."),
      );
      return;
    }
    // Inscription avec activation par e-mail : pas encore de session
    if (isSignUp && data && !("token" in data && data.token)) {
      setPending({ email, reason: "signup" });
      setCooldown(60);
      return;
    }
    router.push(safeNext);
    router.refresh();
  }

  if (pending) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#efebff] text-(--violet)">
          <MailCheck className="size-7" />
        </span>
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.035em]">Vérifie ta boîte mail</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-(--grey)">
          {pending.reason === "signin" ? "Ton compte n'est pas encore activé. " : ""}
          On a envoyé un lien d&apos;activation à <b className="font-semibold text-(--ink)">{pending.email}</b>. Clique dessus pour
          activer ton compte : tu seras connecté automatiquement.
        </p>
        <p className="mt-2 text-[13px] text-(--grey)">Le lien est valable 24 heures. Pense à regarder dans les courriers indésirables.</p>
        {error && (
          <p className="mt-5 rounded-xl bg-[#fdecec] px-4 py-3 text-[14px] text-[#b42318]" role="alert">
            {error}
          </p>
        )}
        {resent && <p className="mt-5 text-[14px] font-medium text-[#067647]" role="status">Nouveau lien envoyé.</p>}
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl border border-(--line) bg-white text-[15px] font-semibold transition hover:border-(--ink) disabled:opacity-60"
        >
          {cooldown > 0 ? `Renvoyer le lien (${cooldown} s)` : "Renvoyer le lien"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPending(null);
            setError(null);
            setResent(false);
          }}
          className="mt-4 text-[14px] font-semibold text-(--violet) hover:underline"
        >
          Utiliser une autre adresse
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Bascule Connexion / Inscription */}
      <div className="mb-8 grid grid-cols-2 rounded-xl bg-[#f1f1f4] p-1 text-[14px] font-semibold">
        {(["connexion", "inscription"] as const).map((m) =>
          m === mode ? (
            <span key={m} className="rounded-lg bg-white py-2 text-center shadow-sm">
              {m === "connexion" ? "Connexion" : "Inscription"}
            </span>
          ) : (
            <Link key={m} href={switchHref} className="rounded-lg py-2 text-center text-(--grey) hover:text-(--ink)">
              {m === "connexion" ? "Connexion" : "Inscription"}
            </Link>
          ),
        )}
      </div>

      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.035em]">
        {isSignUp ? "Crée ton compte Luka" : "Bon retour sur Luka"}
      </h1>
      <p className="mt-2 text-[15px] text-(--grey)">
        {isSignUp
          ? "Gratuit, sans carte bancaire. Ta première collecte dans quelques minutes."
          : "Connecte-toi pour retrouver tes collectes et tes tableaux."}
      </p>

      {googleEnabled && (
        <>
          <button
            type="button"
            className="mt-7 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-(--line) bg-white text-[15px] font-semibold transition hover:border-(--ink)"
            disabled={googleLoading}
            onClick={async () => {
              setError(null);
              setGoogleLoading(true);
              // En cas d'échec, Google renvoie sur cette page avec ?error=… (message affiché ci-dessous)
              const { error } = await authClient.signIn.social({
                provider: "google",
                callbackURL: safeNext,
                errorCallbackURL: isSignUp ? "/inscription" : "/connexion",
              });
              if (error) {
                setGoogleLoading(false);
                setError(authErrorMessage(error.code ?? ""));
              }
            }}
          >
            <GoogleIcon /> {googleLoading ? "Redirection vers Google…" : "Continuer avec Google"}
          </button>
          <div className="my-6 flex items-center gap-3 text-[13px] text-(--grey)">
            <span className="h-px flex-1 bg-(--line)" /> ou avec ton email <span className="h-px flex-1 bg-(--line)" />
          </div>
        </>
      )}

      {notice && !error && (
        <p className={`rounded-xl bg-[#ecfdf3] px-4 py-3 text-[14px] text-[#067647] ${googleEnabled ? "mb-4" : "mt-7"}`} role="status">
          {notice}
        </p>
      )}
      <form onSubmit={onSubmit} className={`space-y-4 ${googleEnabled || notice ? "" : "mt-7"}`}>
        {isSignUp && (
          <div>
            <label className={label} htmlFor="name">Nom</label>
            <input className={input} id="name" name="name" required minLength={2} autoComplete="name" placeholder="Ton nom" />
          </div>
        )}
        <div>
          <label className={label} htmlFor="email">Email</label>
          <input
            className={input}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={defaultEmail}
            placeholder="nom@exemple.com"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label className="text-[14px] font-medium" htmlFor="password">Mot de passe</label>
            {!isSignUp && (
              <Link href="/mot-de-passe-oublie" className="text-[13px] font-medium text-(--violet) hover:underline">
                Mot de passe oublié ?
              </Link>
            )}
          </div>
          <div className="relative">
            <input
              className={`${input} pr-12`}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder={isSignUp ? "8 caractères minimum" : "Ton mot de passe"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-(--grey) hover:text-(--ink)"
            >
              {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
        </div>
        <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />
        {error && (
          <p className="rounded-xl bg-[#fdecec] px-4 py-3 text-[14px] text-[#b42318]" role="alert">
            {error}
          </p>
        )}
        <button
          className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-(--violet) text-[15px] font-semibold text-white transition hover:bg-[#5000e6] disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Patiente…" : isSignUp ? "Créer mon compte gratuit" : "Se connecter"}
        </button>
        {isSignUp && (
          <p className="text-center text-[13px] leading-relaxed text-(--grey)">
            En créant un compte, tu acceptes les{" "}
            <Link href="/conditions-utilisation" className="font-medium text-(--ink) underline underline-offset-2">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="font-medium text-(--ink) underline underline-offset-2">
              politique de confidentialité
            </Link>
            .
          </p>
        )}
      </form>

      <p className="mt-8 text-center text-[14px] text-(--grey)">
        {isSignUp ? "Déjà un compte ? " : "Pas encore de compte ? "}
        <Link className="font-semibold text-(--violet) hover:underline" href={switchHref}>
          {isSignUp ? "Se connecter" : "Créer un compte gratuit"}
        </Link>
      </p>
    </div>
  );
}
