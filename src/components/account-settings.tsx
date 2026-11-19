"use client";

import { Check, KeyRound, LogOut, Mail, ShieldAlert, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Props = {
  user: { name: string; email: string; emailVerified: boolean; premium: boolean };
  hasPassword: boolean;
  /** Identifiant du compte Google relié, sinon null. */
  googleAccountId: string | null;
  googleEnabled: boolean;
  otherSessions: number;
  /** Code d'erreur renvoyé par Google après une liaison ratée. */
  linkError?: string;
  linked?: boolean;
};

type Status = { ok: boolean; text: string } | null;

function Feedback({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p className={`text-[13px] ${status.ok ? "text-emerald-400" : "text-danger"}`} role={status.ok ? "status" : "alert"}>
      {status.text}
    </p>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="icon-box shrink-0">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-[13px] text-muted">{desc}</p>
          <div className="mt-4 space-y-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

function linkErrorMessage(code: string) {
  const c = code.toLowerCase();
  if (c.includes("already_linked")) {
    return "Ce compte Google est déjà utilisé par un autre compte Luka. Connecte-toi avec Google pour supprimer cet autre compte, puis recommence.";
  }
  if (c.includes("access_denied")) return "Liaison avec Google annulée.";
  return "La liaison avec Google a échoué. Réessaie.";
}

export function AccountSettings(p: Props) {
  const router = useRouter();

  // Profil
  const [name, setName] = useState(p.user.name);
  const [nameStatus, setNameStatus] = useState<Status>(null);
  const [savingName, setSavingName] = useState(false);

  // Mot de passe
  const [pwStatus, setPwStatus] = useState<Status>(null);
  const [savingPw, setSavingPw] = useState(false);

  // Google
  const [googleStatus, setGoogleStatus] = useState<Status>(
    p.linkError ? { ok: false, text: linkErrorMessage(p.linkError) } : p.linked ? { ok: true, text: "Compte Google relié." } : null,
  );
  const [googleBusy, setGoogleBusy] = useState(false);

  // Sessions et suppression
  const [sessionStatus, setSessionStatus] = useState<Status>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<Status>(null);
  const [deleting, setDeleting] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameStatus(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) return setNameStatus({ ok: false, text: "Le nom doit faire au moins 2 caractères." });
    setSavingName(true);
    const { error } = await authClient.updateUser({ name: trimmed });
    setSavingName(false);
    if (error) return setNameStatus({ ok: false, text: "L'enregistrement a échoué. Réessaie." });
    setNameStatus({ ok: true, text: "Nom enregistré." });
    router.refresh();
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwStatus(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const next = String(data.get("new"));
    if (next !== String(data.get("confirm"))) return setPwStatus({ ok: false, text: "Les deux mots de passe ne correspondent pas." });
    setSavingPw(true);
    let error: string | null = null;
    if (p.hasPassword) {
      const res = await authClient.changePassword({
        currentPassword: String(data.get("current")),
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        error =
          res.error.code === "INVALID_PASSWORD"
            ? "Mot de passe actuel incorrect."
            : res.error.code === "PASSWORD_TOO_SHORT"
              ? "Le nouveau mot de passe doit faire au moins 8 caractères."
              : res.error.status === 429
                ? "Trop de tentatives. Réessaie dans une minute."
                : "Le changement a échoué. Réessaie.";
      }
    } else {
      const res = await fetch("/api/compte/mot-de-passe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: next }),
      });
      if (!res.ok) error = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "La création a échoué.";
    }
    setSavingPw(false);
    if (error) return setPwStatus({ ok: false, text: error });
    form.reset();
    setPwStatus({
      ok: true,
      text: p.hasPassword
        ? "Mot de passe modifié. Tes autres appareils ont été déconnectés."
        : "Mot de passe créé : tu peux aussi te connecter avec ton e-mail.",
    });
    router.refresh();
  }

  async function linkGoogle() {
    setGoogleStatus(null);
    setGoogleBusy(true);
    const { error } = await authClient.linkSocial({
      provider: "google",
      callbackURL: "/compte?google=relie",
      errorCallbackURL: "/compte",
    });
    if (error) {
      setGoogleBusy(false);
      setGoogleStatus({ ok: false, text: linkErrorMessage(error.code ?? "") });
    }
  }

  async function unlinkGoogle() {
    setGoogleStatus(null);
    setGoogleBusy(true);
    if (!p.googleAccountId) return;
    const { error } = await authClient.unlinkAccount({ accountId: p.googleAccountId });
    setGoogleBusy(false);
    if (error) return setGoogleStatus({ ok: false, text: "Impossible de délier Google. Crée d'abord un mot de passe." });
    setGoogleStatus({ ok: true, text: "Compte Google délié." });
    router.refresh();
  }

  async function revokeOthers() {
    setSessionStatus(null);
    const { error } = await authClient.revokeOtherSessions();
    if (error) return setSessionStatus({ ok: false, text: "La déconnexion a échoué. Réessaie." });
    setSessionStatus({ ok: true, text: "Tes autres appareils ont été déconnectés." });
    router.refresh();
  }

  async function requestDelete() {
    setDeleteStatus(null);
    setDeleting(true);
    const { error } = await authClient.deleteUser({ callbackURL: "/connexion?compte=supprime" });
    setDeleting(false);
    if (error) {
      return setDeleteStatus({
        ok: false,
        text: error.status === 429 ? "Trop de demandes. Réessaie dans une minute." : "La demande a échoué. Réessaie.",
      });
    }
    setConfirmDelete(false);
    setDeleteStatus({
      ok: true,
      text: `E-mail envoyé à ${p.user.email}. Clique sur le lien qu'il contient (valable 1 heure) pour confirmer la suppression.`,
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Mon compte</h1>
        <p className="text-[13px] text-muted">
          {p.user.email} · Formule {p.user.premium ? "Premium" : "gratuite"}
        </p>
      </div>

      <Section icon={User} title="Profil" desc="Ton nom apparaît dans Luka et dans les e-mails que tu reçois.">
        <form onSubmit={saveName} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="name">Nom</label>
          <input id="name" className="input flex-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
          <button className="btn-primary" disabled={savingName || name.trim() === p.user.name}>
            {savingName ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
        <Feedback status={nameStatus} />
      </Section>

      <Section
        icon={Mail}
        title="Adresse e-mail"
        desc="Elle sert à te connecter et à recevoir les liens de Luka (activation, mot de passe, fin de collecte)."
      >
        <p className="flex items-center gap-2 text-[14px]">
          {p.user.email}
          {p.user.emailVerified && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
              <Check className="size-3" /> vérifiée
            </span>
          )}
        </p>
      </Section>

      <Section
        icon={KeyRound}
        title={p.hasPassword ? "Mot de passe" : "Créer un mot de passe"}
        desc={
          p.hasPassword
            ? "Après le changement, tes autres appareils sont déconnectés."
            : "Tu te connectes avec Google. Un mot de passe te permet aussi de te connecter avec ton e-mail."
        }
      >
        <form onSubmit={savePassword} className="space-y-3">
          {p.hasPassword && (
            <div>
              <label className="label" htmlFor="current">Mot de passe actuel</label>
              <input id="current" name="current" type="password" className="input w-full" required autoComplete="current-password" />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new">Nouveau mot de passe</label>
              <input id="new" name="new" type="password" className="input w-full" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Confirmation</label>
              <input id="confirm" name="confirm" type="password" className="input w-full" required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          <button className="btn-primary" disabled={savingPw}>
            {savingPw ? "Enregistrement…" : p.hasPassword ? "Changer le mot de passe" : "Créer le mot de passe"}
          </button>
        </form>
        <Feedback status={pwStatus} />
      </Section>

      {p.googleEnabled && (
        <Section
          icon={() => (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.55 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z" />
            </svg>
          )}
          title="Connexion avec Google"
          desc={
            Boolean(p.googleAccountId)
              ? "Ton compte Google est relié : tu peux te connecter en un clic."
              : "Relie ton compte Google pour te connecter en un clic, même s'il utilise une autre adresse."
          }
        >
          {Boolean(p.googleAccountId) ? (
            <button className="btn-ghost" onClick={unlinkGoogle} disabled={googleBusy || !p.hasPassword}>
              Délier Google
            </button>
          ) : (
            <button className="btn-primary" onClick={linkGoogle} disabled={googleBusy}>
              {googleBusy ? "Redirection vers Google…" : "Relier mon compte Google"}
            </button>
          )}
          {Boolean(p.googleAccountId) && !p.hasPassword && (
            <p className="text-[12px] text-muted">Crée d&apos;abord un mot de passe pour pouvoir délier Google.</p>
          )}
          <Feedback status={googleStatus} />
        </Section>
      )}

      <Section
        icon={LogOut}
        title="Appareils connectés"
        desc={
          p.otherSessions > 0
            ? `Tu es aussi connecté sur ${p.otherSessions} autre(s) appareil(s) ou navigateur(s).`
            : "Tu n'es connecté que sur cet appareil."
        }
      >
        <button className="btn-ghost" onClick={revokeOthers} disabled={p.otherSessions === 0}>
          Déconnecter les autres appareils
        </button>
        <Feedback status={sessionStatus} />
      </Section>

      <section className="card border-danger/40 p-5">
        <div className="flex items-start gap-3">
          <span className="icon-box shrink-0 border-danger/30 bg-danger-soft text-danger">
            <ShieldAlert className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold">Supprimer mon compte</h2>
            <p className="text-[13px] text-muted">
              Ton compte, tes collectes et toutes leurs lignes seront supprimés définitivement. Exporte d&apos;abord ce que tu veux garder.
            </p>
            <div className="mt-4 space-y-3">
              {confirmDelete ? (
                <div className="space-y-3 rounded-md border border-danger/40 bg-danger-soft p-3">
                  <p className="text-[13px]">
                    On va t&apos;envoyer un e-mail de confirmation à <b>{p.user.email}</b>. La suppression n&apos;aura lieu
                    qu&apos;après le clic sur le lien.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-danger" onClick={requestDelete} disabled={deleting}>
                      {deleting ? "Envoi…" : "Envoyer l'e-mail de confirmation"}
                    </button>
                    <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
                  Supprimer mon compte
                </button>
              )}
              <Feedback status={deleteStatus} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
