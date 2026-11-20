"use client";

import { ChevronRight, FileSpreadsheet, HeartHandshake, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { guessField, KB_FIELDS, KB_LABELS, type KbField, MAX_CONTRIBUTION_ROWS } from "@/lib/kb-fields";
import { readFile, type Sheet } from "@/lib/sheet";

export type MyContribution = {
  id: string;
  title: string;
  city: string;
  rowCount: number;
  status: string;
  added: number;
  updated: number;
  reviewNote: string | null;
  createdAt: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "En vérification", cls: "bg-warn-soft text-warn" },
  approved: { label: "Acceptée", cls: "bg-accent-soft text-accent" },
  rejected: { label: "Non retenue", cls: "bg-surface-2 text-muted" },
};

/** Associe chaque colonne du fichier à un champ de la base (deviné, modifiable), sans doublon. */
function initialMapping(headers: string[]) {
  const used = new Set<KbField>();
  return headers.map((h) => {
    const f = guessField(h);
    if (!f || used.has(f)) return null;
    used.add(f);
    return f;
  });
}

export function ContributeForm({ mine }: { mine: MyContribution[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<(KbField | null)[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [consent, setConsent] = useState(false);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function load(file: File | undefined, sheetName?: string) {
    if (!file) return;
    setError(null);
    setDone(null);
    if (file.size > 10 * 1024 * 1024) return setError("Fichier trop lourd (10 Mo maximum).");
    setReading(true);
    try {
      const s = await readFile(file, sheetName);
      if (s.rows.length > MAX_CONTRIBUTION_ROWS) s.rows = s.rows.slice(0, MAX_CONTRIBUTION_ROWS);
      setSheet(s);
      setMapping(initialMapping(s.headers));
      setTitle((t) => t || s.fileName.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setSheet(null);
      setError((e as Error).message || "Impossible de lire ce fichier.");
    }
    setReading(false);
  }

  function setField(i: number, f: KbField | null) {
    // Une information ne peut venir que d'une colonne : l'ancienne colonne est libérée
    setMapping((m) => m.map((x, j) => (j === i ? f : f && x === f ? null : x)));
  }

  const kept = mapping.filter(Boolean).length;
  const named = sheet ? sheet.rows.filter((r) => r[mapping.indexOf("nom")]?.trim()).length : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sheet) return setError("Choisis d'abord un fichier.");
    if (!mapping.includes("nom")) return setError("Indique quelle colonne contient le nom des établissements.");
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, city, category, fileName: sheet.fileName, mapping, rows: sheet.rows, consent }),
    });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) return setError(json.error ?? "Envoi impossible");
    setDone(`Merci ! ${json.rows} ligne(s) envoyée(s). Tu seras notifié dès qu'elles seront vérifiées.`);
    setSheet(null);
    setMapping([]);
    setTitle("");
    setDescription("");
    setConsent(false);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <nav className="flex items-center gap-1 text-xs text-muted" aria-label="Fil d'Ariane">
          <Link href="/tableau-de-bord" className="hover:text-text">
            Mes collectes
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-text">Contribuer</span>
        </nav>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Contribuer à la base Luka</h1>
        <p className="max-w-2xl text-[13px] text-muted">
          Tu as une liste d&apos;établissements (écoles, pharmacies, hôtels, entreprises…) ? Envoie-la : après vérification, elle rejoint la base commune
          et aide tous les utilisateurs de Luka à trouver des données plus vite.
        </p>
      </div>

      {done && (
        <p className="rounded-lg bg-accent-soft px-4 py-3 text-[13px] text-accent" role="status">
          {done}
        </p>
      )}

      <form onSubmit={submit} className="card space-y-5 p-5">
        <input ref={input} type="file" accept=".xlsx,.csv,.txt,.json" className="sr-only" onChange={(e) => load(e.target.files?.[0])} aria-label="Choisir un fichier" />
        {!sheet ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              load(e.dataTransfer.files[0]);
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors ${
              dragging ? "border-accent bg-accent-soft" : "border-border hover:border-accent"
            }`}
          >
            {reading ? <Loader2 className="size-6 animate-spin text-muted" /> : <Upload className="size-6 text-muted" />}
            <span className="text-[14px] font-medium">{reading ? "Lecture du fichier…" : "Choisis ou dépose ton fichier ici"}</span>
            <span className="text-xs text-muted">Excel (.xlsx), CSV ou JSON · jusqu&apos;à {MAX_CONTRIBUTION_ROWS.toLocaleString("fr-FR")} lignes, 10 Mo</span>
          </button>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
              <FileSpreadsheet className="size-5 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{sheet.fileName}</p>
                <p className="text-xs text-muted">
                  {sheet.rows.length.toLocaleString("fr-FR")} ligne(s) · {kept} colonne(s) retenue(s) sur {sheet.headers.length}
                </p>
              </div>
              {sheet.sheets && sheet.sheets.length > 1 && (
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  Onglet
                  <select
                    className="input w-auto py-1 text-[12.5px]"
                    value={sheet.sheet}
                    onChange={(e) => load(sheet.file, e.target.value)}
                    aria-label="Onglet du classeur"
                  >
                    {sheet.sheets.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" className="btn-ghost" onClick={() => input.current?.click()}>
                Changer
              </button>
            </div>

            <div>
              <p className="label">Ce que contient chaque colonne</p>
              <p className="mb-2 text-xs text-muted">
                Luka a deviné ; corrige si besoin. Les colonnes « Ignorer » ne sont pas envoyées : ignore toute colonne qui parle d&apos;une personne
                (nom d&apos;un responsable, numéro personnel…).
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-surface-2 text-muted">
                    <tr>
                      {sheet.headers.map((h, i) => (
                        <th key={i} className="min-w-[150px] px-2 py-2 align-top font-medium">
                          <span className="mb-1 block truncate px-1">{h}</span>
                          <select
                            className="input py-1 text-[12px]"
                            value={mapping[i] ?? ""}
                            aria-label={`Information de la colonne ${h}`}
                            onChange={(e) => setField(i, (e.target.value || null) as KbField | null)}
                          >
                            <option value="">Ignorer</option>
                            {KB_FIELDS.map((f) => (
                              <option key={f} value={f}>
                                {KB_LABELS[f]}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(0, 4).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {sheet.headers.map((_, j) => (
                          <td key={j} className={`max-w-[220px] truncate px-3 py-1.5 ${mapping[j] ? "" : "text-muted line-through"}`}>
                            {r[j]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!mapping.includes("nom") && <p className="mt-1.5 text-xs text-danger">Choisis la colonne qui contient le nom des établissements.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="c-title">
                  Titre
                </label>
                <input id="c-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="c-city">
                  Ville
                </label>
                <input
                  id="c-city"
                  className="input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex. : Brazzaville"
                  required
                  minLength={2}
                  maxLength={80}
                />
                <p className="mt-1 text-xs text-muted">Utilisée pour les lignes sans colonne « Ville ».</p>
              </div>
              <div>
                <label className="label" htmlFor="c-cat">
                  Type d&apos;établissements <span className="font-normal text-muted">(facultatif)</span>
                </label>
                <input id="c-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex. : Pharmacie" maxLength={80} />
              </div>
              <div>
                <label className="label" htmlFor="c-desc">
                  Contenu et origine des données
                </label>
                <input
                  id="c-desc"
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex. : relevé fait sur le terrain en octobre 2026"
                  required
                  minLength={10}
                  maxLength={1000}
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
              <span>
                Je confirme que ces données sont publiques ou que j&apos;ai le droit de les partager, qu&apos;elles ne concernent pas des personnes privées, et
                j&apos;accepte qu&apos;elles soient réutilisées par Luka et ses utilisateurs.
              </span>
            </label>

            <p className="text-xs text-muted">
              {named.toLocaleString("fr-FR")} ligne(s) avec un nom seront envoyées. Elles sont vérifiées par l&apos;équipe Luka avant d&apos;entrer dans la
              base.
            </p>
          </>
        )}

        {error && (
          <p className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger" role="alert">
            {error}
          </p>
        )}

        {sheet && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSheet(null);
                setError(null);
              }}
            >
              Annuler
            </button>
            <button className="btn-primary px-5" disabled={submitting || !consent || !mapping.includes("nom")}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {submitting ? "Envoi…" : "Envoyer ma contribution"}
            </button>
          </div>
        )}
      </form>

      <section className="card">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <HeartHandshake className="size-4 text-accent" />
          <h2 className="text-[15px] font-semibold">Mes contributions</h2>
          {mine.some((m) => m.status === "approved") && (
            <span className="ml-auto text-xs text-muted">
              {mine.reduce((n, m) => n + m.added, 0).toLocaleString("fr-FR")} établissement(s) ajouté(s) à Luka grâce à toi
            </span>
          )}
        </div>
        {mine.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">Aucune contribution pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-border">
            {mine.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13px]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.title}</span>
                  <span className="text-xs text-muted">
                    {m.city} · {m.rowCount.toLocaleString("fr-FR")} ligne(s) · {new Date(m.createdAt).toLocaleDateString("fr-FR")}
                    {m.status === "approved" && ` · ${m.added} ajouté(s), ${m.updated} complété(s)`}
                    {m.status === "rejected" && m.reviewNote && ` · ${m.reviewNote}`}
                  </span>
                </span>
                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS[m.status]?.cls ?? ""}`}>{STATUS[m.status]?.label ?? m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
