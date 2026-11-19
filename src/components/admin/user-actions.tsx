"use client";

import { Crown, Plus, ShieldOff, Trash2, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PAYMENT_METHODS } from "./format";
import { alertCls, btn, btnDanger, btnGhost, btnSuccess, DialogCard, field, fieldLabel } from "./ui";

async function call(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  if (res.ok) return null;
  return ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "L'opération a échoué.";
}

/** Fenêtre de confirmation dans le style de la maquette. */
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={title}>
      <DialogCard
        as="h2"
        title={title}
        subtitle={text}
        footer={
          <>
            <button className={btnGhost} onClick={onCancel} autoFocus>
              Annuler
            </button>
            <button className={danger ? btnDanger : btn} disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </>
        }
      />
    </div>
  );
}

/** Actions de la fiche utilisateur : formule Premium et suspension. */
export function UserActions({ user, self }: { user: { id: string; name: string; plan: string; blocked: boolean }; self: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"block" | "premium" | "free" | null>(null);

  async function update(change: { plan?: "free" | "premium"; blocked?: boolean }) {
    setBusy(true);
    setError(null);
    const err = await call(`/api/admin/utilisateurs/${user.id}`, { method: "PATCH", body: JSON.stringify(change) });
    setBusy(false);
    setConfirm(null);
    if (err) return setError(err);
    router.refresh();
  }

  const premium = user.plan === "premium";
  const who = user.name || "cet utilisateur";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {premium ? (
          <button className={btn} disabled={busy} onClick={() => setConfirm("free")}>
            Repasser en gratuit
          </button>
        ) : (
          <button className={btnSuccess} disabled={busy} onClick={() => setConfirm("premium")}>
            <Crown className="size-3.5" /> Passer en Premium
          </button>
        )}
        {!self &&
          (user.blocked ? (
            <button className={btn} disabled={busy} onClick={() => update({ blocked: false })}>
              <UserRoundCheck className="size-3.5" /> Réactiver le compte
            </button>
          ) : (
            <button className={btnDanger} disabled={busy} onClick={() => setConfirm("block")}>
              <ShieldOff className="size-3.5" /> Bloquer le compte
            </button>
          ))}
      </div>
      {error && (
        <p className={alertCls} role="alert">
          {error}
        </p>
      )}
      {confirm === "block" && (
        <ConfirmDialog
          danger
          busy={busy}
          title={`Bloquer ${who} ?`}
          text="Ses sessions sont fermées tout de suite et il ne peut plus se connecter, ni par e-mail ni avec Google. Ses collectes sont conservées et tu pourras le réactiver."
          confirmLabel="Bloquer"
          onConfirm={() => update({ blocked: true })}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "premium" && (
        <ConfirmDialog
          busy={busy}
          title={`Passer ${who} en Premium ?`}
          text="Il profite tout de suite des limites Premium et des sources payantes (Google Maps, Instagram, Facebook). Pense à enregistrer son paiement ci-dessous."
          confirmLabel="Passer en Premium"
          onConfirm={() => update({ plan: "premium" })}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "free" && (
        <ConfirmDialog
          busy={busy}
          title={`Repasser ${who} en gratuit ?`}
          text="Ses prochaines collectes utiliseront les limites de la formule gratuite. Ses collectes passées ne changent pas."
          confirmLabel="Repasser en gratuit"
          onConfirm={() => update({ plan: "free" })}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

/** Enregistrer un paiement reçu (Mobile Money, espèces…) pour suivre les revenus. */
export function PaymentForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const err = await call(`/api/admin/utilisateurs/${userId}/paiements`, {
      method: "POST",
      body: JSON.stringify({ amount: Number(f.get("amount")), method: f.get("method"), note: String(f.get("note") ?? "") }),
    });
    setBusy(false);
    if (err) return setError(err);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button className={btn} onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> Enregistrer un paiement
      </button>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-border bg-bg/50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={fieldLabel} htmlFor="amount">
            Montant (FCFA)
          </label>
          <input id="amount" name="amount" type="number" min={1} step={1} required autoFocus inputMode="numeric" className={field} />
        </div>
        <div>
          <label className={fieldLabel} htmlFor="method">
            Moyen de paiement
          </label>
          <select id="method" name="method" className={field} defaultValue="mobile_money">
            {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={fieldLabel} htmlFor="note">
          Note <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <input id="note" name="note" maxLength={200} placeholder="Ex. : abonnement de novembre, référence MTN…" className={field} />
      </div>
      {error && (
        <p className={alertCls} role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button className={btn} disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

/** Supprimer un paiement saisi par erreur (avec confirmation). */
export function DeletePayment({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className={`${btnGhost} hover:text-danger`} onClick={() => setConfirm(true)} aria-label={`Supprimer le paiement ${label}`}>
        <Trash2 className="size-3.5" />
      </button>
      {confirm && (
        <ConfirmDialog
          danger
          busy={busy}
          title="Supprimer ce paiement ?"
          text={`Le paiement de ${label} sera retiré des revenus. Cette suppression est définitive.`}
          confirmLabel="Supprimer"
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            await call(`/api/admin/paiements/${id}`, { method: "DELETE" });
            setBusy(false);
            setConfirm(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
