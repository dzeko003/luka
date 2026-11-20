"use client";

import { Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { KB_LABELS, type KbField } from "@/lib/kb-fields";
import { dateShort, int } from "./format";
import { alertCls, btnGhost } from "./ui";
import { ConfirmDialog } from "./user-actions";

export type KbRow = {
  id: string;
  name: string;
  city: string;
  category: string | null;
  confirmations: number;
  updatedAt: string;
  fields: Record<string, { v: string | number; n: number; src: string }>;
};

const SHOWN: KbField[] = ["telephone", "site_web", "adresse", "quartier", "email"];

/** Recherche dans la base Luka et retrait d'une fiche (demande de retrait, donnée erronée). */
export function KbTable({ rows }: { rows: KbRow[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [confirm, setConfirm] = useState<KbRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(r: KbRow) {
    setBusy(true);
    const res = await fetch(`/api/admin/base/${r.id}`, { method: "DELETE" });
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return setError("Suppression impossible");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(q.trim() ? `/admin/base?q=${encodeURIComponent(q.trim())}` : "/admin/base");
        }}
        className="relative max-w-sm"
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, ville ou catégorie, puis Entrée"
          aria-label="Rechercher dans la base"
          className="h-8 w-full rounded-md border border-border-strong bg-bg pr-2 pl-8 text-[13px] outline-none placeholder:text-muted focus:border-focus"
        />
      </form>
      {error && (
        <p className={alertCls} role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead className="bg-bg/60 text-[12px] text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 font-medium">Établissement</th>
              {SHOWN.map((f) => (
                <th key={f} className="px-3 py-2.5 font-medium">
                  {KB_LABELS[f]}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium">Confirmé</th>
              <th className="px-3 py-2.5 font-medium">Mis à jour</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={SHOWN.length + 4} className="px-3 py-10 text-center text-muted">
                  Aucun établissement.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                <td className="px-3 py-2">
                  <span className="block max-w-[240px] truncate font-medium">{r.name}</span>
                  <span className="block text-[12px] text-muted">
                    {r.city}
                    {r.category ? ` · ${r.category}` : ""}
                  </span>
                </td>
                {SHOWN.map((f) => (
                  <td key={f} className="max-w-[180px] truncate px-3 py-2" title={r.fields[f] ? `Vu ${r.fields[f].n} fois · ${r.fields[f].src}` : undefined}>
                    {r.fields[f]?.v ?? <span className="text-muted">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{int(r.confirmations)} fois</td>
                <td className="px-3 py-2 whitespace-nowrap text-muted">{dateShort.format(new Date(r.updatedAt))}</td>
                <td className="px-3 py-2 text-right">
                  <button className={`${btnGhost} hover:text-danger`} onClick={() => setConfirm(r)} aria-label={`Retirer ${r.name}`}>
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirm && (
        <ConfirmDialog
          danger
          busy={busy}
          title={`Retirer ${confirm.name} de la base ?`}
          text="La fiche est supprimée définitivement de la base Luka. Les collectes déjà faites ne changent pas ; elle pourra revenir si un utilisateur la valide à nouveau."
          confirmLabel="Retirer"
          onConfirm={() => remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
