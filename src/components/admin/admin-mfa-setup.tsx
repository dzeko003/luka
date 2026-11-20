"use client";

import { Check, Copy, Download } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { alertCls as alert, btn, btnGhost, DialogCard, field, fieldLabel } from "./ui";

type Step = "password" | "scan" | "codes";

export type Enrollment = { qr: string; secret: string; codes: string[] };

/** Prépare l'affichage de l'activation : QR code, clé à saisir à la main et codes de secours. */
export async function prepareEnrollment(totpURI: string, backupCodes: string[]): Promise<Enrollment> {
  return {
    qr: await QRCode.toDataURL(totpURI, { margin: 1, width: 360, color: { dark: "#111113", light: "#ffffff" } }),
    secret: new URL(totpURI).searchParams.get("secret") ?? "",
    codes: backupCodes,
  };
}

/**
 * Activation de la double authentification (Google Authenticator) avant le premier accès à l'administration.
 * Depuis la connexion admin, le QR code est déjà prêt (`initial`) ; sinon le mot de passe est demandé d'abord.
 */
export function AdminMfaSetup({ hasPassword = true, initial }: { hasPassword?: boolean; initial?: Enrollment }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initial ? "scan" : "password");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState<string | null>(initial?.qr ?? null);
  const [secret, setSecret] = useState(initial?.secret ?? "");
  const [codes, setCodes] = useState<string[]>(initial?.codes ?? []);
  const [copied, setCopied] = useState<"secret" | "codes" | null>(null);
  const [saved, setSaved] = useState(false);

  async function copy(text: string, what: "secret" | "codes") {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  }

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await authClient.twoFactor.enable({ password: String(new FormData(e.currentTarget).get("password")) });
    if (error || !data || !("totpURI" in data)) {
      setLoading(false);
      return setError(
        error?.code === "INVALID_PASSWORD" ? "Mot de passe incorrect." : error?.status === 429 ? "Trop de tentatives. Réessaie dans une minute." : "L'activation a échoué. Réessaie.",
      );
    }
    const e2 = await prepareEnrollment(data.totpURI, data.backupCodes);
    setQr(e2.qr);
    setSecret(e2.secret);
    setCodes(e2.codes);
    setLoading(false);
    setStep("scan");
  }

  async function onVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const code = String(new FormData(e.currentTarget).get("code")).replace(/\s+/g, "");
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setLoading(false);
    if (error) return setError(error.code === "INVALID_CODE" ? "Code incorrect. Vérifie l'heure de ton téléphone et réessaie." : "La vérification a échoué. Réessaie.");
    setStep("codes");
  }

  function download() {
    const text = `Codes de secours — Admin Luka\nChaque code ne sert qu'une fois.\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "luka-admin-codes-de-secours.txt" });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (step === "password") {
    return (
      <DialogCard
        title="Active la double authentification"
        subtitle="Obligatoire pour l'administration. Confirme ton mot de passe, puis relie Google Authenticator."
        footer={
          <>
            <Link href="/tableau-de-bord" className={btnGhost}>
              Annuler
            </Link>
            <button form="pw-form" className={btn} disabled={loading || !hasPassword}>
              {loading ? "Patiente…" : "Afficher le QR code"}
            </button>
          </>
        }
      >
        <form id="pw-form" onSubmit={onPassword} className="space-y-4">
          {!hasPassword && (
            <p className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-[13px] text-warn">
              Ton compte n&apos;a pas encore de mot de passe : l&apos;administration en demande un en plus du code. Crée-le dans{" "}
              <Link href="/compte" className="underline underline-offset-2">
                Mon compte
              </Link>
              , puis reviens ici.
            </p>
          )}
          <div>
            <label className={fieldLabel} htmlFor="password">
              Mot de passe
            </label>
            <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className={field} />
          </div>
          {error && (
            <p className={alert} role="alert">
              {error}
            </p>
          )}
        </form>
      </DialogCard>
    );
  }

  if (step === "scan") {
    return (
      <DialogCard
        wide
        title="Relie Google Authenticator"
        subtitle="Dans l'application : « + », puis « Scanner un code QR ». Saisis ensuite le code affiché."
        footer={
          <button form="verify-form" className={btn} disabled={loading}>
            {loading ? "Vérification…" : "Activer"}
          </button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element -- image générée dans le navigateur (data URL)
              <img src={qr} alt="QR code à scanner avec Google Authenticator" width={180} height={180} className="rounded-lg bg-white p-1.5" />
            )}
          </div>
          <form id="verify-form" onSubmit={onVerify} className="min-w-0 space-y-4">
            <div>
              <p className={fieldLabel}>Pas de caméra ? Saisis cette clé</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-border-strong bg-bg px-2.5 py-2 font-mono text-[12px] text-muted">{secret}</code>
                <button type="button" className={btnGhost} onClick={() => copy(secret, "secret")} aria-label="Copier la clé">
                  {copied === "secret" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className={fieldLabel} htmlFor="code">
                Code à 6 chiffres
              </label>
              <input
                id="code"
                name="code"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                placeholder="000 000"
                className={`${field} h-11 text-center font-mono text-[18px] tracking-[0.3em]`}
              />
            </div>
            {error && (
              <p className={alert} role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </DialogCard>
    );
  }

  return (
    <DialogCard
      wide
      title="Garde tes codes de secours"
      subtitle="Si tu perds ton téléphone, chacun de ces codes ouvre l'administration une seule fois. Range-les hors de ce navigateur."
      footer={
        <button
          className={btn}
          disabled={!saved}
          onClick={() => {
            router.push("/admin");
            router.refresh();
          }}
        >
          Ouvrir l&apos;administration
        </button>
      }
    >
      <ul className="grid grid-cols-2 gap-2 font-mono text-[13px]">
        {codes.map((c) => (
          <li key={c} className="rounded-md border border-border-strong bg-bg px-2 py-1.5 text-center">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" className={btnGhost} onClick={() => copy(codes.join("\n"), "codes")}>
          {copied === "codes" ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} Copier
        </button>
        <button type="button" className={btnGhost} onClick={download}>
          <Download className="size-3.5" /> Télécharger
        </button>
      </div>
      <label className="mt-4 flex min-h-10 items-center gap-2.5 text-[13px] text-muted">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-4 accent-(--text)" />
        J&apos;ai rangé mes codes de secours en lieu sûr
      </label>
    </DialogCard>
  );
}
