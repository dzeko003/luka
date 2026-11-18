"use client";

import { ChevronRight, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PLACE_CATALOG, placeFieldOf } from "@/lib/connectors/places";
import { TEMPLATES, type Template, type TemplateColumn } from "@/lib/templates";

const MAX_COLUMNS = 25;

type Col = TemplateColumn;

const TYPES = [
  { v: "texte", l: "Texte" },
  { v: "nombre", l: "Nombre" },
  { v: "url", l: "Lien (URL)" },
  { v: "date", l: "Date" },
  { v: "booleen", l: "Oui / Non" },
];

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** Badge « Auto » (ou « Premium ») : la colonne est remplie directement par les sources de lieux. */
function FieldBadge({ col, premium }: { col: Col; premium: boolean }) {
  const field = placeFieldOf(col);
  if (!field) return null;
  const info = PLACE_CATALOG[field];
  const locked = info.premium && !premium;
  return (
    <span
      title={`Rempli automatiquement : ${info.label.toLowerCase()} (${info.aide})${locked ? ". Formule Premium uniquement." : ""}`}
      className={`absolute top-1/2 right-2 -translate-y-1/2 cursor-help rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        locked ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"
      }`}
    >
      {locked ? "Premium" : "Auto"}
    </span>
  );
}

function Step({ n, title, hint, children, action }: { n: number; title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-xs font-semibold text-accent">{n}</span>
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {hint && <p className="text-xs text-muted">{hint}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export function NewCollecteForm({
  maxRows,
  premium = false,
  template,
  initialRequest,
}: {
  maxRows: number;
  premium?: boolean;
  template?: Template;
  initialRequest?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(template?.title ?? "");
  const [request, setRequest] = useState(template?.request ?? initialRequest ?? "");
  const [columns, setColumns] = useState<Col[]>(template?.columns ?? []);
  // Valeur par défaut raisonnable : en Premium, chaque lieu Google Maps est facturé
  const [rowsWanted, setRowsWanted] = useState(Math.min(maxRows, 500));
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateCol = (i: number, patch: Partial<Col>) =>
    setColumns((cols) => cols.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  // Colonnes déjà saisies : conservées, l'IA propose seulement des compléments
  const kept = columns.filter((c) => c.label.trim()).map((c) => ({ ...c, name: slug(c.name || c.label) || "colonne" }));

  async function suggest() {
    setError(null);
    setSuggesting(true);
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request, columns: kept }),
    });
    const json = await res.json().catch(() => ({}));
    setSuggesting(false);
    if (!res.ok) return setError(json.error ?? "Suggestion impossible");
    if (json.title && !title) setTitle(json.title);
    if (json.columns?.length) setColumns([...kept, ...json.columns].slice(0, MAX_COLUMNS));
    else if (kept.length) setError("L'IA n'a pas trouvé de colonne utile à ajouter.");
  }

  const autoCount = columns.filter((c) => placeFieldOf(c)).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cols = columns
      .filter((c) => c.label.trim())
      .map((c) => ({ ...c, name: slug(c.name || c.label) || "colonne" }));
    if (!cols.length) return setError("Ajoute au moins une colonne (ou clique sur « Suggérer les colonnes »).");
    setSubmitting(true);
    const res = await fetch("/api/collectes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || request.slice(0, 80), request, columns: cols, maxRows: rowsWanted }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSubmitting(false);
      return setError(json.error ?? "Impossible de lancer la collecte");
    }
    router.push(`/collectes/${json.id}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl space-y-5">
      <div>
        <nav className="flex items-center gap-1 text-xs text-muted" aria-label="Fil d'Ariane">
          <Link href="/tableau-de-bord" className="hover:text-text">Mes collectes</Link>
          <ChevronRight className="size-3" />
          <span className="text-text">Nouvelle collecte</span>
        </nav>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Nouvelle collecte</h1>
        <p className="text-[13px] text-muted">Décris ce que tu cherches, vérifie les colonnes, puis lance la collecte.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Partir d&apos;un modèle :</span>
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/collectes/nouvelle?modele=${t.id}`}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              template?.id === t.id
                ? "border-accent bg-accent-soft font-medium text-accent"
                : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <Step n={1} title="Ta demande" hint="Sois précis : pays, ville, période, type d'information…">
        <div>
          <label className="label" htmlFor="request">Que veux-tu collecter ?</label>
          <textarea
            id="request"
            className="input min-h-28 resize-y"
            placeholder="Ex. : Liste des hôpitaux publics de Brazzaville avec leur adresse et leur numéro de téléphone"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            required
            minLength={10}
            maxLength={2000}
          />
        </div>
        <div>
          <label className="label" htmlFor="title">Titre</label>
          <input
            id="title"
            className="input"
            placeholder="Ex. : Hôpitaux de Brazzaville"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>
      </Step>

      <Step
        n={2}
        title="Les colonnes du tableau"
        hint="La première colonne identifie chaque ligne (ex. le nom)."
        action={
          <button
            type="button"
            className="btn-ghost"
            disabled={suggesting || request.trim().length < 10 || kept.length >= MAX_COLUMNS}
            onClick={suggest}
          >
            {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-accent" />}
            {suggesting ? "Réflexion…" : kept.length ? "Compléter avec l'IA" : "Suggérer les colonnes"}
          </button>
        }
      >
        {columns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
            Aucune colonne. Clique sur « Suggérer les colonnes » ou ajoute-les toi-même.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <div className="hidden grid-cols-[1fr_150px_1.4fr_36px] gap-2 bg-surface-2 px-3 py-2 text-xs text-muted sm:grid">
              <span>Nom de la colonne</span>
              <span>Type</span>
              <span>Précision pour l&apos;IA</span>
              <span />
            </div>
            <ul className="divide-y divide-border">
              {columns.map((c, i) => (
                <li key={i} className="grid gap-2 p-3 sm:grid-cols-[1fr_150px_1.4fr_36px] sm:items-center">
                  <div className="relative">
                    <input
                      className={`input ${placeFieldOf(c) ? "pr-20" : ""}`}
                      aria-label="Nom de la colonne"
                      placeholder="Nom de la colonne"
                      value={c.label}
                      onChange={(e) => updateCol(i, { label: e.target.value, name: slug(e.target.value) })}
                      maxLength={60}
                    />
                    <FieldBadge col={c} premium={premium} />
                  </div>
                  <select className="input" aria-label="Type" value={c.type} onChange={(e) => updateCol(i, { type: e.target.value })}>
                    {TYPES.map((t) => (
                      <option key={t.v} value={t.v}>{t.l}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    aria-label="Précision pour l'IA"
                    placeholder="Facultatif"
                    value={c.description ?? ""}
                    onChange={(e) => updateCol(i, { description: e.target.value })}
                    maxLength={200}
                  />
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"
                    aria-label={`Supprimer la colonne ${c.label}`}
                    onClick={() => setColumns((cols) => cols.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {autoCount > 0 && (
          <p className="text-xs text-muted">
            <span className="font-medium text-accent">Auto</span> : {autoCount} colonne(s) remplie(s) automatiquement pour les lieux
            (cartes, sites web, réseaux sociaux).
            {!premium && " Les colonnes marquées Premium restent vides avec la formule gratuite."}
          </p>
        )}
        {columns.length < MAX_COLUMNS && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline"
            onClick={() => setColumns((cols) => [...cols, { name: "", label: "", type: "texte" }])}
          >
            <Plus className="size-4" /> Ajouter une colonne
          </button>
        )}
      </Step>

      <Step n={3} title="Quantité" hint={
          premium
            ? `Formule Premium : ${maxRows.toLocaleString("fr-FR")} lignes maximum, avec Google Maps et les réseaux sociaux.`
            : `Formule gratuite : ${maxRows.toLocaleString("fr-FR")} lignes maximum par collecte.`
        }>
        <div className="flex items-center gap-4">
          <input
            id="rows"
            type="range"
            min={1}
            max={maxRows}
            step={maxRows > 2000 ? 50 : maxRows > 500 ? 10 : 1}
            value={rowsWanted}
            onChange={(e) => setRowsWanted(Math.max(1, Number(e.target.value)))}
            className="flex-1 accent-[var(--accent)]"
            aria-label="Nombre maximum de lignes"
          />
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            <input
              type="number"
              min={1}
              max={maxRows}
              value={rowsWanted}
              onChange={(e) => setRowsWanted(Math.min(Math.max(1, Math.round(Number(e.target.value) || 1)), maxRows))}
              className="input w-24 py-1 text-center text-[13px] tabular-nums"
              aria-label="Nombre maximum de lignes (saisie)"
            />
            lignes
          </label>
        </div>
      </Step>

      {error && <p className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger" role="alert">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Annuler</button>
        <button className="btn-primary px-5" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Lancement…" : "Lancer la collecte"}
        </button>
      </div>
    </form>
  );
}
