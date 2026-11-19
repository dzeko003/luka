"use client";

import { ChevronLeft, ChevronRight, Download, Search, ShieldCheck, ShieldOff, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { AdminUserRow } from "@/lib/admin-stats";
import { dateShort, fcfa, int, providerLabel, usdSmall } from "./format";
import { alertCls, Avatar, Badge, btn, btnGhost } from "./ui";
import { ConfirmDialog } from "./user-actions";

type Filter = "tous" | "premium" | "free" | "bloques";
const filters: { id: Filter; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "free", label: "Gratuits" },
  { id: "premium", label: "Premium" },
  { id: "bloques", label: "Bloqués" },
];
const PAGE = 15;

/** Gestion des utilisateurs : recherche, filtres, formule, blocage (avec confirmation) et export CSV. */
export function AdminUsers({ users, currentAdminId }: { users: AdminUserRow[]; currentAdminId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("tous");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<AdminUserRow | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)) &&
        (filter === "tous" || (filter === "bloques" ? u.blocked : u.plan === filter)),
    );
  }, [users, query, filter]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const slice = shown.slice(current * PAGE, current * PAGE + PAGE);

  async function update(id: string, change: { plan?: "free" | "premium"; blocked?: boolean }) {
    setError(null);
    setBusy(id);
    const res = await fetch(`/api/admin/utilisateurs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    setBusy(null);
    setConfirm(null);
    if (!res.ok) {
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "La modification a échoué.");
      return;
    }
    router.refresh();
  }

  function exportCsv() {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ["Nom", "E-mail", "Connexion", "Formule", "Rôle", "Statut", "Inscrit le", "Collectes", "Connexions", "Coût IA (USD)", "Apify (USD)", "Revenus (FCFA)"];
    const lines = shown.map((u) =>
      [
        u.name,
        u.email,
        providerLabel(u.providers),
        u.plan === "premium" ? "Premium" : "Gratuite",
        u.role,
        u.blocked ? "Bloqué" : u.emailVerified ? "Actif" : "Non activé",
        u.createdAt.slice(0, 10),
        u.collectes,
        u.logins,
        u.aiCostUsd.toFixed(4),
        u.apify.toFixed(2),
        u.revenue,
      ]
        .map(cell)
        .join(";"),
    );
    const blob = new Blob(["﻿" + [head.map(cell).join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `luka-utilisateurs-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrer" className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => (setFilter(f.id), setPage(0))}
              aria-pressed={filter === f.id}
              className={`h-8 rounded-md px-2.5 text-[13px] transition-colors ${
                filter === f.id ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <label className="relative flex-1 sm:w-60 sm:flex-none">
            <span className="sr-only">Rechercher un utilisateur</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => (setQuery(e.target.value), setPage(0))}
              placeholder="Rechercher"
              className="h-8 w-full rounded-md border border-border-strong bg-bg pr-2 pl-8 text-[13px] outline-none placeholder:text-muted focus:border-focus"
            />
          </label>
          <button className={btn} onClick={exportCsv}>
            <Download className="size-3.5" /> Exporter
          </button>
        </div>
      </div>

      {error && (
        <p className={alertCls} role="alert">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-[13px]">
            <thead className="bg-bg/60 text-[12px] text-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 font-medium">Utilisateur</th>
                <th className="px-3 py-2.5 font-medium">E-mail</th>
                <th className="px-3 py-2.5 font-medium">Inscrit le</th>
                <th className="px-3 py-2.5 text-right font-medium">Collectes</th>
                <th className="px-3 py-2.5 text-right font-medium">Connexions</th>
                <th className="px-3 py-2.5 text-right font-medium">Coût IA</th>
                <th className="px-3 py-2.5 text-right font-medium">Revenus</th>
                <th className="px-3 py-2.5 font-medium">Formule</th>
                <th className="px-3 py-2.5 font-medium">Statut</th>
                <th className="px-3 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-muted">
                    Aucun utilisateur ne correspond.
                  </td>
                </tr>
              )}
              {slice.map((u) => {
                const self = u.id === currentAdminId;
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                    <td className="px-3 py-2">
                      <Link href={`/admin/utilisateurs/${u.id}`} className="group flex items-center gap-2.5">
                        <Avatar name={u.name || u.email} />
                        <span className="max-w-[180px] truncate font-medium group-hover:underline group-hover:underline-offset-2">{u.name}</span>
                        {u.role === "admin" && <Badge>admin</Badge>}
                      </Link>
                    </td>
                    <td className="max-w-[230px] truncate px-3 py-2">
                      <a href={`mailto:${u.email}`} className="text-muted underline decoration-border-strong underline-offset-2 hover:text-text">
                        {u.email}
                      </a>
                      <span className="block text-[11.5px] text-muted">{providerLabel(u.providers)}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{dateShort.format(new Date(u.createdAt))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{int(u.collectes)}</td>
                    <td
                      className="px-3 py-2 text-right tabular-nums"
                      title={u.lastLoginAt ? `Dernière : ${dateShort.format(new Date(u.lastLoginAt))}` : "Aucune connexion enregistrée"}
                    >
                      {int(u.logins)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{usdSmall(u.aiCostUsd)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{u.revenue ? fcfa(u.revenue) : "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={u.plan}
                        disabled={busy === u.id}
                        onChange={(e) => update(u.id, { plan: e.target.value as "free" | "premium" })}
                        aria-label={`Formule de ${u.email}`}
                        className="h-7 rounded-md border border-border-strong bg-bg px-1.5 text-[12.5px] outline-none focus:border-focus"
                      >
                        <option value="free">Gratuite</option>
                        <option value="premium">Premium</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {u.blocked ? (
                          <Badge tone="danger">Bloqué</Badge>
                        ) : u.emailVerified ? (
                          <Badge tone="success">Actif</Badge>
                        ) : (
                          <Badge tone="warn">Non activé</Badge>
                        )}
                        {u.twoFactorEnabled && (
                          <span title="Double authentification active" className="text-success">
                            <ShieldCheck className="size-3.5" aria-label="Double authentification active" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {self ? (
                        <span className="px-2.5 text-[12px] text-muted">toi</span>
                      ) : u.blocked ? (
                        <button className={btnGhost} disabled={busy === u.id} onClick={() => update(u.id, { blocked: false })}>
                          <UserRoundCheck className="size-3.5" /> Réactiver
                        </button>
                      ) : (
                        <button className={`${btnGhost} hover:text-danger`} disabled={busy === u.id} onClick={() => setConfirm(u)}>
                          <ShieldOff className="size-3.5" /> Bloquer
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
        <span>
          {shown.length === 0 ? "0" : `${current * PAGE + 1}–${Math.min(shown.length, (current + 1) * PAGE)}`} sur {shown.length} utilisateur
          {shown.length > 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1">
          <button className={btnGhost} disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Page précédente">
            <ChevronLeft className="size-4" />
          </button>
          <span className="px-1.5 tabular-nums">
            {current + 1} / {pages}
          </span>
          <button className={btnGhost} disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Page suivante">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          danger
          busy={busy === confirm.id}
          title={`Bloquer ${confirm.name || confirm.email} ?`}
          text="Ses sessions sont fermées tout de suite et il ne peut plus se connecter, ni par e-mail ni avec Google. Ses collectes sont conservées et tu pourras le réactiver."
          confirmLabel="Bloquer"
          onConfirm={() => update(confirm.id, { blocked: true })}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
