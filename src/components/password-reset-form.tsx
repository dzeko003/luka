"use client";

import { Eye, EyeOff, KeyRound, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Turnstile, turnstileSiteKey } from "./turnstile";

const input =
  "h-12 w-full rounded-xl border border-(--line) bg-white px-4 text-[15px] text-(--ink) outline-none transition placeholder:text-[#a3a6b1] focus:border-(--violet) focus:ring-4 focus:ring-[#5e0aff]/10";
const label = "mb-1.5 block text-[14px] font-medium";
const primary =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-(--violet) text-[15px] font-semibold text-white transition hover:bg-[#5000e6] disabled:opacity-60";
const alert = "rounded-xl bg-[#fdecec] px-4 py-3 text-[14px] text-[#b42318]";

function Icon({ children }: { children: React.ReactNode }) {
  return <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#efebff] text-(--violet)">{children}</span>;
}

const backLink = (
  <p className="mt-8 text-center text-[14px] text-(--grey)">
    <Link className="font-semibold text-(--violet) hover:underline" href="/connexion">
      Retour à la connexion
    </Link>
  </p>
);

/** Étape 1 : l'utilisateur saisit son e-mail et reçoit un lien. */
export function ForgotPasswordForm({ defaultEmail }: { defaultEmail?: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (turnstileSiteKey && !captcha) return setError("Valide le captcha avant de continuer.");
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setLoading(true);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/nouveau-mot-de-passe",
      fetchOptions: captcha ? { headers: { "x-captcha-response": captcha } } : undefined,
    });
    setLoading(false);
    if (error) {
      return setError(error.status === 429 ? "Trop de demandes. Réessaie dans une minute." : "L'envoi a échoué. Réessaie dans un instant.");
    }
    // Même réponse que l'adresse existe ou non : on ne révèle pas qui a un compte
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <Icon>
          <MailCheck className="size-7" />
        </Icon>
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.035em]">Vérifie ta boîte mail</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-(--grey)">
          Si un compte existe avec <b className="font-semibold text-(--ink)">{sentTo}</b>, tu vas recevoir un lien pour choisir un
          nouveau mot de passe.
        </p>
        <p className="mt-2 text-[13px] text-(--grey)">Le lien est valable 1 heure. Pense à regarder dans les courriers indésirables.</p>
        <button type="button" onClick={() => setSentTo(null)} className="mt-6 text-[14px] font-semibold text-(--violet) hover:underline">
          Utiliser une autre adresse
        </button>
        {backLink}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.035em]">Mot de passe oublié</h1>
      <p className="mt-2 text-[15px] text-(--grey)">Indique l&apos;email de ton compte : on t&apos;envoie un lien pour en choisir un nouveau.</p>
      <form onSubmit={onSubmit} className="mt-7 space-y-4">
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
        <Turnstile onToken={setCaptcha} />
        {error && (
          <p className={alert} role="alert">
            {error}
          </p>
        )}
        <button className={primary} disabled={loading}>
          {loading ? "Patiente…" : "Recevoir le lien"}
        </button>
      </form>
      {backLink}
    </div>
  );
}

/** Étape 2 : depuis le lien reçu, l'utilisateur choisit un nouveau mot de passe. */
export function ResetPasswordForm({ token, linkError }: { token?: string; linkError?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  if (linkError || !token) {
    return (
      <div className="text-center">
        <Icon>
          <KeyRound className="size-7" />
        </Icon>
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-[-0.035em]">Lien expiré</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-(--grey)">
          Ce lien de réinitialisation a expiré ou a déjà servi. Demande un nouveau lien : il est valable 1 heure.
        </p>
        <Link href="/mot-de-passe-oublie" className={`${primary} mt-6`}>
          Demander un nouveau lien
        </Link>
        {backLink}
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError("Les deux mots de passe ne correspondent pas.");
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      return setError(
        error.code === "INVALID_TOKEN"
          ? "Ce lien a expiré ou a déjà servi. Demande un nouveau lien."
          : error.code === "PASSWORD_TOO_SHORT"
            ? "Le mot de passe doit faire au moins 8 caractères."
            : "Le changement a échoué. Réessaie dans un instant.",
      );
    }
    router.push("/connexion?reinitialise=1");
  }

  return (
    <div>
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.035em]">Nouveau mot de passe</h1>
      <p className="mt-2 text-[15px] text-(--grey)">Choisis un nouveau mot de passe pour ton compte Luka.</p>
      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <div>
          <label className={label} htmlFor="password">Nouveau mot de passe</label>
          <div className="relative">
            <input
              className={`${input} pr-12`}
              id="password"
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8 caractères minimum"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-(--grey) hover:text-(--ink)"
            >
              {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
        </div>
        <div>
          <label className={label} htmlFor="confirm">Confirme le mot de passe</label>
          <input
            className={input}
            id="confirm"
            name="confirm"
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Le même, une seconde fois"
          />
        </div>
        {error && (
          <p className={alert} role="alert">
            {error}
          </p>
        )}
        <button className={primary} disabled={loading}>
          {loading ? "Patiente…" : "Enregistrer le mot de passe"}
        </button>
      </form>
      {backLink}
    </div>
  );
}
