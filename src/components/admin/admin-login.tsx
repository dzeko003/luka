"use client";

import { ArrowLeft, KeyRound, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { captchaErrorMessage, Turnstile, turnstileSiteKey } from "../turnstile";
import { alertCls as alert, btn, btnGhost, DialogCard, field, fieldLabel } from "./ui";

function codeError(code?: string, status?: number) {
  if (code === "INVALID_CODE" || code === "INVALID_BACKUP_CODE") return "Code incorrect. Vérifie l'heure de ton téléphone et réessaie.";
  if (code === "ACCOUNT_TEMPORARILY_LOCKED" || code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE")
    return "Trop d'essais. Patiente quelques minutes, puis reconnecte-toi.";
  if (status === 429) return "Trop de tentatives. Réessaie dans une minute.";
  return "La vérification a échoué. Réessaie.";
}

/**
 * Connexion à l'administration en deux étapes : e-mail + mot de passe, puis code Google Authenticator
 * (ou un code de secours). Une connexion Google ne suffit pas.
 */
export function AdminLogin({ startAtCode, notice }: { startAtCode?: boolean; notice?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "code">(startAtCode ? "code" : "password");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (turnstileSiteKey && !captcha) return setError("Valide le captcha avant de continuer.");
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
      fetchOptions: captcha ? { headers: { "x-captcha-response": captcha } } : undefined,
    });
    setLoading(false);
    if (captcha) setCaptchaReset((n) => n + 1);
    if (error) {
      return setError(
        error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "E-mail ou mot de passe incorrect."
          : error.code === "EMAIL_NOT_VERIFIED"
            ? "Active d'abord ton compte avec le lien reçu par e-mail."
            : error.code === "ACCOUNT_BLOCKED"
              ? "Ce compte est suspendu."
              : error.status === 429
                ? "Trop de tentatives. Réessaie dans une minute."
                : (captchaErrorMessage(error.code) ?? "La connexion a échoué. Réessaie."),
      );
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setStep("code");
      return;
    }
    // Double authentification pas encore activée : page d'activation (404 pour un compte non administrateur)
    router.push("/admin/securite");
    router.refresh();
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s+/g, "");
    setLoading(true);
    const { error } = backup ? await authClient.twoFactor.verifyBackupCode({ code }) : await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (error) {
      if (error.code === "INVALID_TWO_FACTOR_COOKIE" || (error.status === 401 && !error.code)) {
        setStep("password");
        return setError("La vérification a expiré (10 minutes). Reconnecte-toi.");
      }
      return setError(codeError(error.code, error.status));
    }
    router.push("/admin");
    router.refresh();
  }

  if (step === "code") {
    return (
      <DialogCard
        title={backup ? "Code de secours" : "Code de vérification"}
        subtitle={
          backup
            ? "Saisis l'un des codes de secours obtenus à l'activation. Chaque code ne sert qu'une fois."
            : "Ouvre Google Authenticator et saisis le code à 6 chiffres affiché pour Luka."
        }
        footer={
          <>
            <button type="button" className={btnGhost} onClick={() => (setError(null), setBackup((b) => !b))}>
              {backup ? <Smartphone className="size-3.5" /> : <KeyRound className="size-3.5" />}
              {backup ? "Utiliser l'application" : "Utiliser un code de secours"}
            </button>
            <button form="code-form" className={btn} disabled={loading}>
              {loading ? "Vérification…" : "Vérifier"}
            </button>
          </>
        }
      >
        <form id="code-form" onSubmit={onCode} className="space-y-4">
          <div>
            <label className={fieldLabel} htmlFor="code">
              {backup ? "Code de secours" : "Code à 6 chiffres"}
            </label>
            <input
              key={backup ? "backup" : "totp"}
              id="code"
              name="code"
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode={backup ? "text" : "numeric"}
              pattern={backup ? undefined : "[0-9 ]{6,7}"}
              maxLength={backup ? 24 : 7}
              placeholder={backup ? "xxxxx-xxxxx" : "000 000"}
              className={`${field} h-12 text-center font-mono text-[20px] tracking-[0.3em]`}
            />
          </div>
          {error && (
            <p className={alert} role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => (setError(null), setStep("password"))}
            className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-text"
          >
            <ArrowLeft className="size-3" /> Changer de compte
          </button>
        </form>
      </DialogCard>
    );
  }

  return (
    <DialogCard
      title="Accès administrateur"
      subtitle="Réservé à l'équipe Luka. Un code Google Authenticator te sera demandé ensuite."
      footer={
        <>
          <Link href="/" className={btnGhost}>
            Annuler
          </Link>
          <button form="password-form" className={btn} disabled={loading}>
            {loading ? "Connexion…" : "Continuer"}
          </button>
        </>
      }
    >
      <form id="password-form" onSubmit={onPassword} className="space-y-4">
        {notice && <p className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-[13px] text-muted">{notice}</p>}
        <div>
          <label className={fieldLabel} htmlFor="email">
            E-mail
          </label>
          <input id="email" name="email" type="email" required autoComplete="username" autoFocus className={field} />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="password">
            Mot de passe
          </label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className={field} />
        </div>
        <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />
        {error && (
          <p className={alert} role="alert">
            {error}
          </p>
        )}
        <p className="text-[12px] leading-relaxed text-muted">La connexion avec Google n&apos;ouvre pas l&apos;administration.</p>
      </form>
    </DialogCard>
  );
}
