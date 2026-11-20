"use client";

import { Check, ChevronRight, FileSpreadsheet, Loader2, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PLACE_CATALOG, type PlaceField } from "@/lib/connectors/places";
import { readFile, type Sheet } from "@/lib/sheet";

const MAX_COLUMNS = 25;
const MAX_IMPORT_ROWS = 2000;

/** Colonnes proposées en un clic : ce qu'on cherche le plus souvent à compléter. */
const QUICK: PlaceField[] = ["telephone", "whatsapp", "email", "site_web", "adresse", "quartier", "ville", "categorie", "horaires", "facebook", "instagram", "linkedin", "note", "nombre_avis"];

type NewCol = { name: string; label: string; type: string; description?: string; field?: string };

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** Devine la colonne qui identifie chaque ligne (le nom), sinon la première. */
function guessKey(headers: string[]) {
  const i = headers.findIndex((h) => /\b(nom|name|raison sociale|entreprise|etablissement|société|societe|structure)\b/i.test(h.normalize("NFD").replace(/[̀-ͯ]/g, "")));
  return i >= 0 ? i : 0;
}

export function EnrichForm({ maxRows, premium }: { maxRows: number; premium: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [keyCol, setKeyCol] = useState(0);
  const [request, setRequest] = useState("");
  const [title, setTitle] = useState("");
  const [cols, setCols] = useState<NewCol[]>([]);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [share, setShare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > 10 * 1024 * 1024) return setError("Fichier trop lourd (10 Mo maximum).");
    setReading(true);
    try {
      const s = await readFile(file);
      if (s.rows.length > MAX_IMPORT_ROWS) s.rows = s.rows.slice(0, MAX_IMPORT_ROWS);
      setSheet(s);
      setKeyCol(guessKey(s.headers));
      setTitle((t) => t || `${s.fileName.replace(/\.[^.]+$/, "")} enrichi`);
    } catch (e) {
      setSheet(null);
      setError((e as Error).message || "Impossible de lire ce fichier.");
    }
    setReading(false);
  }

  const has = (field: string) => cols.some((c) => c.field === field);
  const already = (label: string) => sheet?.headers.some((h) => slug(h) === slug(label));
  const toggleQuick = (f: PlaceField) =>
    setCols((cs) => (cs.some((c) => c.field === f) ? cs.filter((c) => c.field !== f) : [...cs, { name: f, label: PLACE_CATALOG[f].label, type: PLACE_CATALOG[f].type, field: f }]));
  const update = (i: number, patch: Partial<NewCol>) => setCols((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const total = sheet ? sheet.headers.length + cols.length : 0;
  const filled = sheet ? sheet.rows.filter((r) => r[keyCol]).length : 0;
  const done = Math.min(filled, maxRows);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sheet) return setError("Choisis d'abord un fichier.");
    const columns = cols.filter((c) => c.label.trim()).map((c) => ({ ...c, name: c.field ?? (slug(c.label) || "colonne") }));
    if (!columns.length) return setError("Choisis au moins une colonne à compléter.");
    if (total > MAX_COLUMNS) return setError(`${MAX_COLUMNS} colonnes maximum au total (fichier + colonnes ajoutées).`);
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/enrichissements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || sheet.fileName, request, fileColumns: sheet.headers, keyColumn: keyCol, rows: sheet.rows, columns, share }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitting(false);
      return setError(json.error ?? "Impossible de lancer l'enrichissement");
    }
    router.push(`/collectes/${json.id}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
      <div>
        <nav className="flex items-center gap-1 text-xs text-muted" aria-label="Fil d'Ariane">
          <Link href="/tableau-de-bord" className="hover:text-text">
            Mes collectes
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-text">Compléter un fichier</span>
        </nav>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Compléter un fichier</h1>
        <p className="text-[13px] text-muted">
          Importe ta liste (clients, prospects, fournisseurs…) : Luka cherche chaque ligne et ajoute les informations qui manquent, avec leur source.
        </p>
      </div>

      <section className="card">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-xs font-semibold text-accent">1</span>
          <div>
            <h2 className="text-[15px] font-semibold">Ton fichier</h2>
            <p className="text-xs text-muted">Excel (.xlsx) ou CSV, avec une ligne de titres. Première feuille seulement.</p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <input ref={input} type="file" accept=".xlsx,.csv,.txt,.json" className="sr-only" onChange={(e) => load(e.target.files?.[0])} aria-label="Choisir un fichier" />
          {!sheet ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => (e.preventDefault(), setDragging(true))}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => (e.preventDefault(), setDragging(false), load(e.dataTransfer.files[0]))}
              className={`flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors ${
                dragging ? "border-accent bg-accent-soft" : "border-border hover:border-accent"
              }`}
            >
              {reading ? <Loader2 className="size-6 animate-spin text-muted" /> : <Upload className="size-6 text-muted" />}
              <span className="text-[14px] font-medium">{reading ? "Lecture du fichier…" : "Choisis ou dépose ton fichier ici"}</span>
              <span className="text-xs text-muted">Jusqu&apos;à {MAX_IMPORT_ROWS.toLocaleString("fr-FR")} lignes, 10 Mo</span>
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <FileSpreadsheet className="size-5 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{sheet.fileName}</p>
                  <p className="text-xs text-muted">
                    {sheet.rows.length.toLocaleString("fr-FR")} ligne(s) · {sheet.headers.length} colonne(s)
                  </p>
                </div>
                <button type="button" className="btn-ghost" onClick={() => input.current?.click()}>
                  Changer
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="bg-surface-2 text-muted">
                    <tr>
                      {sheet.headers.map((h, i) => (
                        <th key={i} className={`px-3 py-2 font-medium whitespace-nowrap ${i === keyCol ? "text-accent" : ""}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(0, 4).map((r, i) => (
                      <tr key={i} className="border-t border-border">
                        {sheet.headers.map((_, j) => (
                          <td key={j} className="max-w-[220px] truncate px-3 py-1.5">
                            {r[j]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="key">
                    Colonne qui identifie chaque ligne
                  </label>
                  <select id="key" className="input" value={keyCol} onChange={(e) => setKeyCol(Number(e.target.value))}>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted">Le nom de l&apos;entreprise, de l&apos;établissement… C&apos;est ce que Luka recherche.</p>
                </div>
                <div>
                  <label className="label" htmlFor="title">
                    Titre
                  </label>
                  <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="request">
                  Que contient ce fichier ?
                </label>
                <input
                  id="request"
                  className="input"
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder="Ex. : des pharmacies de Brazzaville, des écoles privées de Pointe-Noire…"
                  required
                  minLength={5}
                  maxLength={2000}
                />
                <p className="mt-1 text-xs text-muted">Indique la ville ou le pays : la recherche est bien plus précise.</p>
              </div>
            </>
          )}
        </div>
      </section>

      {sheet && (
        <section className="card">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-xs font-semibold text-accent">2</span>
            <div>
              <h2 className="text-[15px] font-semibold">Ce qu&apos;il faut ajouter</h2>
              <p className="text-xs text-muted">Les colonnes de ton fichier sont gardées telles quelles.</p>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((f) => {
                const info = PLACE_CATALOG[f];
                const on = has(f);
                const locked = info.premium && !premium;
                const dup = !on && already(info.label);
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={locked || dup}
                    onClick={() => toggleQuick(f)}
                    aria-pressed={on}
                    title={locked ? "Formule Premium uniquement" : dup ? "Déjà dans ton fichier" : info.aide}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-45 ${
                      on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                    {info.label}
                    {locked && <span className="ml-1 rounded bg-warn-soft px-1 text-[10px] font-semibold text-warn">Premium</span>}
                  </button>
                );
              })}
            </div>

            {cols.some((c) => !c.field) && (
              <ul className="space-y-2">
                {cols.map((c, i) =>
                  c.field ? null : (
                    <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_36px]">
                      <input className="input" aria-label="Nom de la colonne" placeholder="Nom de la colonne" value={c.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={60} />
                      <input
                        className="input"
                        aria-label="Précision"
                        placeholder="Précision facultative (ex. nom du directeur)"
                        value={c.description ?? ""}
                        onChange={(e) => update(i, { description: e.target.value })}
                        maxLength={200}
                      />
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
                        aria-label={`Supprimer la colonne ${c.label}`}
                        onClick={() => setCols((cs) => cs.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
            {total < MAX_COLUMNS && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
                onClick={() => setCols((cs) => [...cs, { name: "", label: "", type: "texte" }])}
              >
                <Plus className="size-4" /> Autre information
              </button>
            )}

            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
              {done.toLocaleString("fr-FR")} ligne(s) seront complétées
              {filled > maxRows && ` sur ${filled.toLocaleString("fr-FR")} : ta formule ${premium ? "Premium" : "gratuite"} en complète ${maxRows.toLocaleString("fr-FR")} par fichier`}.
              {premium ? " Google Maps, la recherche web et les sites des établissements sont utilisés." : " Recherche web et sites des établissements ; Google Maps avec la formule Premium."}{" "}
              Rien n&apos;est inventé : une information introuvable reste vide.
            </p>
            <label className="flex items-start gap-2.5 text-[13px]">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={share} onChange={(e) => setShare(e.target.checked)} />
              <span>
                Partager les lignes que je valide avec la base Luka
                <span className="block text-xs text-muted">
                  Seulement les informations publiques d&apos;établissements. Laisse décoché s&apos;il s&apos;agit d&apos;une liste privée (clients, prospects).
                </span>
              </span>
            </label>
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>
          Annuler
        </button>
        <button className="btn-primary px-5" disabled={submitting || !sheet}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Lancement…" : "Compléter le fichier"}
        </button>
      </div>
    </form>
  );
}
