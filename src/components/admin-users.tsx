"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  role: string;
  blocked: boolean;
  emailVerified: boolean;
  createdAt: string;
  providers: string;
  collectes: number;
  lastCollecte: string | null;
  apify: number;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Africa/Brazzaville" });
const usd = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** Liste des utilisateurs : formule (gratuite / Premium) et suspension. */
export function AdminUsers({ users, currentAdminId }: { users: AdminUserRow[]; currentAdminId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)) : users;
  }, [users, query]);

  async function update(id: string, change: { plan?: "free" | "premium"; blocked?: boolean }) {
    setError(null);
    setBusy(id);
    const res = await fetch(`/api/admin/utilisateurs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    setBusy(null);
    setConfirmBlock(null);
    if (!res.ok) {
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "La modification a échoué.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-semibold">
          Utilisateurs <span className="font-normal text-muted">({users.length})</span>
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom ou e-mail…"
            aria-label="Rechercher un utilisateur"
            className="input h-8 w-full pl-8 text-[13px]"
          />
        </div>
      </div>
      {error && (
        <p className="border-b border-border bg-danger-soft px-4 py-2 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="text-[12px] text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-medium">Utilisateur</th>
              <th className="px-4 py-2 font-medium">Connexion</th>
              <th className="px-4 py-2 font-medium">Inscrit</th>
              <th className="px-4 py-2 text-right font-medium">Collectes</th>
              <th className="px-4 py-2 text-right font-medium">Apify</th>
              <th className="px-4 py-2 font-medium">Formule</th>
              <th className="px-4 py-2 font-medium">Accès</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Aucun utilisateur.
                </td>
              </tr>
            )}
            {shown.map((u) => {
              const self = u.id === currentAdminId;
              return (
                <tr key={u.id} className={`border-b border-border last:border-0 ${u.blocked ? "opacity-60" : ""}`}>
                  <td className="max-w-[260px] px-4 py-2">
                    <p className="truncate font-medium">
                      {u.name}
                      {u.role === "admin" && <span className="ml-1.5 rounded bg-surface-2 px-1 text-[10px] text-muted">admin</span>}
                    </p>
                    <p className="truncate text-[12px] text-muted">
                      {u.email}
                      {!u.emailVerified && " · non activé"}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {u.providers
                      .split(",")
                      .filter(Boolean)
                      .map((p) => (p === "credential" ? "e-mail" : p === "google" ? "Google" : p))
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-muted">{dateFmt.format(new Date(u.createdAt))}</td>
                  <td className="px-4 py-2 text-right tabular-nums" title={u.lastCollecte ? `Dernière : ${dateFmt.format(new Date(u.lastCollecte))}` : undefined}>
                    {u.collectes}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{u.apify ? usd(u.apify) : "—"}</td>
                  <td className="px-4 py-2">
                    <select
                      value={u.plan}
                      disabled={busy === u.id}
                      onChange={(e) => update(u.id, { plan: e.target.value as "free" | "premium" })}
                      aria-label={`Formule de ${u.email}`}
                      className="input h-8 py-0 text-[13px]"
                    >
                      <option value="free">Gratuite</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {self ? (
                      <span className="text-[12px] text-muted">toi</span>
                    ) : u.blocked ? (
                      <button className="btn-ghost h-8 text-[12px]" disabled={busy === u.id} onClick={() => update(u.id, { blocked: false })}>
                        Réactiver
                      </button>
                    ) : confirmBlock === u.id ? (
                      <span className="inline-flex gap-1.5">
                        <button className="btn-danger h-8 text-[12px]" disabled={busy === u.id} onClick={() => update(u.id, { blocked: true })}>
                          Confirmer
                        </button>
                        <button className="btn-ghost h-8 text-[12px]" onClick={() => setConfirmBlock(null)}>
                          Annuler
                        </button>
                      </span>
                    ) : (
                      <button className="btn-ghost h-8 text-[12px] text-danger" onClick={() => setConfirmBlock(u.id)}>
                        Suspendre
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
