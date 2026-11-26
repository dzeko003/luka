"use client";

import { Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ENTITY_LABELS, ENTITY_TYPES, type EntityType, fieldLabel } from "@/lib/kb-fields";
import { dateShort, int } from "./format";
import { alertCls, btnGhost } from "./ui";
import { ConfirmDialog } from "./user-actions";

export type KbRow = {
  id: string;
  type: EntityType;
  name: string;
  city: string | null;
  category: string | null;
  confirmations: number;
  links: number;
  updatedAt: string;
  fields: Record<string, { v: string | number; n: number; src: string }>;
};

/** Colonnes affichées selon le type de fiches listées (toutes : celles des lieux, les plus nombreux). */
const SHOWN: Record<EntityType, string[]> = {
  lieu: ["telephone", "site_web", "adresse", "quartier", "email"],
  organisation: ["sigle", "pays", "ville", "site_web"],
  personne: ["orcid", "discipline", "affiliation"],
  publication: ["date", "revue", "doi", "discipline"],
};

/** Recherche dans la base Luka, par type de fiche, et retrait d'une fiche (demande de retrait, donnée erronée). */
export function KbTable({ rows, type, counts }: { rows: KbRow[]; type: EntityType | null; counts: Record<string, number> }) {
  const router = useRouter();
  const sp = useSearchParams();
  const shown = SHOWN[type ?? "lieu"];
  const href = (t: EntityType | null, query = sp.get("q") ?? "") => {
    const p = new URLSearchParams();
    if (t) p.set("type", t);
    if (query) p.set("q", query);
    return p.size ? `/admin/base?${p}` : "/admin/base";
  };
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
          router.push(href(type, q.trim()));
        }}
        className="relative max-w-sm"
      >
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nom, ville, catégorie ou titre, puis Entrée"
          aria-label="Rechercher dans la base"
          className="h-8 w-full rounded-md border border-border-strong bg-bg pr-2 pl-8 text-[13px] outline-none placeholder:text-muted focus:border-focus"
        />
      </form>
      <nav aria-label="Type de fiche" className="flex flex-wrap gap-1.5 text-[13px]">
        {[null, ...ENTITY_TYPES].map((t) => (
          <Link
            key={t ?? "tout"}
            href={href(t)}
            aria-current={t === type ? "page" : undefined}
            className="rounded-md border border-border px-2.5 py-1 text-muted hover:text-text aria-[current=page]:border-border-strong aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-text"
          >
            {t ? ENTITY_LABELS[t].many : "Tout"}
            {t && <span className="ml-1.5 tabular-nums">{counts[t] ?? 0}</span>}
          </Link>
        ))}
      </nav>
      {error && (
        <p className={alertCls} role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-left text-[13px]">
          <thead className="bg-bg/60 text-[12px] text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 font-medium">{type ? ENTITY_LABELS[type].one : "Fiche"}</th>
              {shown.map((f) => (
                <th key={f} className="px-3 py-2.5 font-medium">
                  {fieldLabel(f)}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium">Liens</th>
              <th className="px-3 py-2.5 text-right font-medium">Confirmé</th>
              <th className="px-3 py-2.5 font-medium">Mis à jour</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={shown.length + 5} className="px-3 py-10 text-center text-muted">
                  Aucune fiche.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                <td className="px-3 py-2">
                  <span className="block max-w-[240px] truncate font-medium">{r.name}</span>
                  <span className="block text-[12px] text-muted">
                    {[!type && ENTITY_LABELS[r.type].one, r.city, r.category].filter(Boolean).join(" · ")}
                  </span>
                </td>
                {shown.map((f) => (
                  <td key={f} className="max-w-[180px] truncate px-3 py-2" title={r.fields[f] ? `Vu ${r.fields[f].n} fois · ${r.fields[f].src}` : undefined}>
                    {r.fields[f]?.v ?? <span className="text-muted">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{int(r.links)}</td>
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
          text="La fiche et ses liens sont supprimés définitivement de la base Luka (demande de retrait, donnée erronée). Les collectes déjà faites ne changent pas ; un lieu pourra revenir si un utilisateur le valide à nouveau."
          confirmLabel="Retirer"
          onConfirm={() => remove(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
