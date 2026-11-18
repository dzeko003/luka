"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Turnstile, turnstileSiteKey } from "./turnstile";

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

export function AuthForm({
  mode,
  googleEnabled,
  defaultEmail,
  next = "/tableau-de-bord",
}: {
  mode: "connexion" | "inscription";
  googleEnabled: boolean;
  defaultEmail?: string;
  /** Page où aller après la connexion (chemin interne uniquement). */
  next?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isSignUp = mode === "inscription";
  // Garde la demande tapée sur l'accueil quand on passe d'un écran à l'autre
  const switchHref = `${isSignUp ? "/connexion" : "/inscription"}${next.startsWith("/collectes/nouvelle?") ? next.slice("/collectes/nouvelle".length) : ""}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (turnstileSiteKey && !captcha) return setError("Valide le captcha avant de continuer.");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const fetchOptions = captcha ? { headers: { "x-captcha-response": captcha } } : undefined;

    setLoading(true);
    const { error } = isSignUp
      ? await authClient.signUp.email({ name: String(form.get("name")), email, password, fetchOptions })
      : await authClient.signIn.email({ email, password, fetchOptions });
    setLoading(false);

    if (error) {
      setError(
        error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Email ou mot de passe incorrect."
          : error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "Un compte existe déjà avec cet email."
            : error.status === 429
              ? "Trop de tentatives. Réessaie dans une minute."
              : (error.message ?? "Une erreur est survenue."),
      );
      return;
    }
    router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/tableau-de-bord");
    router.refresh();
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
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next })}
          >
            <GoogleIcon /> Continuer avec Google
          </button>
          <div className="my-6 flex items-center gap-3 text-[13px] text-(--grey)">
            <span className="h-px flex-1 bg-(--line)" /> ou avec ton email <span className="h-px flex-1 bg-(--line)" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className={`space-y-4 ${googleEnabled ? "" : "mt-7"}`}>
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
          <label className={label} htmlFor="password">Mot de passe</label>
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
        <Turnstile onToken={setCaptcha} />
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
