"use client";

import { Check, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fieldLabel, KB_FIELDS } from "@/lib/kb-fields";
import { dateTime, int } from "./format";
import { alertCls, Badge, btnDanger, btnSuccess, field } from "./ui";

export type AdminContribution = {
  id: string;
  title: string;
  description: string;
  city: string;
  category: string | null;
  fileName: string;
  rowCount: number;
  status: string;
  added: number;
  updated: number;
  reviewNote: string | null;
  createdAt: string;
  userEmail: string;
  preview: Record<string, string>[];
  known: number;
};

const STATUS = {
  pending: { label: "À vérifier", tone: "warn" },
  approved: { label: "Acceptée", tone: "success" },
  rejected: { label: "Rejetée", tone: "neutral" },
} as const;

/** Une contribution : aperçu des lignes, part déjà connue de la base, puis acceptation ou rejet motivé. */
function Item({ c }: { c: AdminContribution }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Champs connus d'abord, puis les colonnes gardées telles quelles
  const extras = [...new Set(c.preview.flatMap((r) => Object.keys(r)))].filter((k) => !(KB_FIELDS as readonly string[]).includes(k));
  const cols = [...KB_FIELDS.filter((f) => c.preview.some((r) => r[f])), ...extras];
  const s = STATUS[c.status as keyof typeof STATUS] ?? { label: c.status, tone: "neutral" as const };

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/contributions/${c.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: note || undefined }),
    });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Action impossible");
    router.refresh();
  }

  return (
    <li>
      <details className="group" open={c.status === "pending"}>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 shrink-0 text-muted transition-transform group-open:rotate-90" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{c.title}</span>
            <span className="block truncate text-[12px] text-muted">
              {c.userEmail} · {c.city}
              {c.category ? ` · ${c.category}` : ""} · {int(c.rowCount)} ligne(s)
            </span>
          </span>
          <Badge tone={s.tone}>{s.label}</Badge>
          <span className="hidden w-[118px] shrink-0 text-right text-[12px] text-muted md:block">{dateTime.format(new Date(c.createdAt))}</span>
        </summary>
        <div className="space-y-3 border-t border-border bg-bg/50 px-4 py-4 pl-10 text-[13px]">
          <p className="text-muted">
            <span className="font-medium text-text">Origine indiquée :</span> {c.description} <span className="text-[12px]">({c.fileName})</span>
          </p>
          <p className="text-[12.5px] text-muted">
            Sur les {c.preview.length} premières lignes, {c.known} établissement(s) déjà dans la base (complétés), {c.preview.length - c.known} nouveau(x).
            {c.status === "approved" && ` Résultat : ${c.added} ajouté(s), ${c.updated} complété(s).`}
            {c.status === "rejected" && c.reviewNote && ` Motif : ${c.reviewNote}`}
          </p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  {cols.map((f) => (
                    <th key={f} className="px-2.5 py-1.5 font-medium whitespace-nowrap">
                      {fieldLabel(f)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.preview.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    {cols.map((f) => (
                      <td key={f} className="max-w-[220px] truncate px-2.5 py-1.5">
                        {r[f] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.status === "pending" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${field} max-w-sm flex-1`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Message au contributeur (facultatif, utile en cas de rejet)"
                maxLength={500}
                aria-label="Message au contributeur"
              />
              <button className={btnSuccess} disabled={busy} onClick={() => act("approve")}>
                <Check className="size-3.5" /> Accepter et ajouter à la base
              </button>
              <button className={btnDanger} disabled={busy} onClick={() => act("reject")}>
                <X className="size-3.5" /> Rejeter
              </button>
            </div>
          )}
          {error && (
            <p className={alertCls} role="alert">
              {error}
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

export function ContributionReview({ items }: { items: AdminContribution[] }) {
  if (!items.length)
    return <p className="rounded-lg border border-border px-4 py-10 text-center text-[13px] text-muted">Aucune contribution pour l&apos;instant.</p>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {items.map((c) => (
        <Item key={c.id} c={c} />
      ))}
    </ul>
  );
}
