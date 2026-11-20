import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollecteList } from "@/components/admin/collecte-list";
import { countryName, dateShort, dateTime, fcfa, flag, int, LOGIN_METHODS, PAYMENT_METHODS, providerLabel, usd, usdSmall } from "@/components/admin/format";
import { Avatar, Badge, panel } from "@/components/admin/ui";
import { DeletePayment, PaymentForm, UserActions } from "@/components/admin/user-actions";
import { getUserDetail } from "@/lib/admin-stats";
import { requireConsoleAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Fiche utilisateur" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${panel} p-4`}>
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export default async function Page({ params }: PageProps<"/admin/utilisateurs/[id]">) {
  const admin = await requireConsoleAdmin();
  const { id } = await params;
  const d = await getUserDetail(id);
  if (!d) notFound();
  const { user } = d;
  const lastLogin = d.logins[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/utilisateurs" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> Tous les utilisateurs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name || user.email} image={user.image} size={44} />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-[20px] font-semibold tracking-[-0.02em]">
              {user.name}
              {user.plan === "premium" ? <Badge tone="info">Premium</Badge> : <Badge>Gratuit</Badge>}
              {user.blocked && <Badge tone="danger">Bloqué</Badge>}
              {!user.emailVerified && <Badge tone="warn">Non activé</Badge>}
              {user.role === "admin" && <Badge>admin</Badge>}
            </h1>
            <p className="text-[13px] text-muted">
              <a href={`mailto:${user.email}`} className="underline decoration-border-strong underline-offset-2 hover:text-text">
                {user.email}
              </a>{" "}
              · {providerLabel(d.providers.join(","))} · inscrit le {dateShort.format(user.createdAt)}
            </p>
          </div>
        </div>
        <UserActions user={{ id: user.id, name: user.name, plan: user.plan, blocked: user.blocked }} self={user.id === admin.id} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Collectes" value={int(d.collectes.length)} hint={`${int(d.collectes.reduce((n, x) => n + x.rows, 0))} lignes trouvées`} />
        <Stat
          label="Connexions"
          value={int(d.loginCount.total)}
          hint={lastLogin ? `${d.loginCount.last30} en 30 jours · dernière le ${dateShort.format(lastLogin.createdAt)}` : "aucune enregistrée"}
        />
        <Stat label="Coût IA (estimé)" value={usdSmall(d.ai.costUsd)} hint={`${int(d.ai.tokens)} jetons · ${int(d.ai.calls)} appels`} />
        <Stat label="Dépense Apify" value={d.apify ? usd(d.apify) : "0 $"} hint="sources payantes (Premium)" />
        <Stat label="Revenus" value={fcfa(d.revenue)} hint={`${d.payments.length} paiement${d.payments.length > 1 ? "s" : ""}`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={`${panel} p-4`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold">Paiements</h2>
            <PaymentForm userId={user.id} />
          </div>
          {d.payments.length === 0 ? (
            <p className="text-[13px] text-muted">Aucun paiement enregistré.</p>
          ) : (
            <ul className="divide-y divide-border text-[13px]">
              {d.payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">{fcfa(p.amount)}</p>
                    <p className="truncate text-[12px] text-muted">
                      {PAYMENT_METHODS[p.method] ?? p.method} · {dateTime.format(p.createdAt)}
                      {p.by ? ` · saisi par ${p.by}` : ""}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <DeletePayment id={p.id} label={fcfa(p.amount)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${panel} p-4`}>
          <h2 className="mb-3 text-[14px] font-semibold">Dernières connexions</h2>
          {d.logins.length === 0 ? (
            <p className="text-[13px] text-muted">Aucune connexion enregistrée depuis la mise en place du suivi.</p>
          ) : (
            <ul className="divide-y divide-border text-[13px]">
              {d.logins.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">
                    <span aria-hidden="true">{flag(l.country)}</span> {countryName(l.country)}
                    <span className="text-muted"> · {LOGIN_METHODS[l.method] ?? l.method}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-muted">{dateTime.format(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-[14px] font-semibold">
          Collectes <span className="font-normal text-muted">({d.collectes.length})</span>
        </h2>
        <CollecteList collectes={d.collectes} showUser={false} />
      </section>
    </div>
  );
}
