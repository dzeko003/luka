"use client";

import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDashed,
  Clock,
  Database,
  Download,
  FileJson,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatCard } from "./stat-card";
import { StatusBadge } from "./status-badge";

type Col = { name: string; label: string; type: string; fromFile?: boolean };
type Row = {
  id: string;
  data: Record<string, string | number | boolean | null>;
  sourceUrl: string | null;
  sourceTitle: string | null;
  confidence: number | null;
  status: "a_verifier" | "valide" | "rejete";
  change: "nouveau" | "modifie" | "non_retrouve" | null;
  previous: Record<string, string | number | boolean | null> | null;
};
type Counts = { total: number; valide: number; a_verifier: number; rejete: number };
type Page = { rows: Row[]; total: number; page: number; size: number };

const PAGE_SIZES = [25, 50, 100, 200];
const fmt = (n: number) => n.toLocaleString("fr-FR");

type Collecte = {
  id: string;
  title: string;
  request: string;
  columns: Col[];
  kind?: string;
  status: string;
  progress: number;
  error: string | null;
  log: { at: string; message: string; level?: string }[];
  llmCalls: number;
  tokensUsed: number;
  costUsd: number;
  tier: string;
  createdAt: string;
  refresh: "aucune" | "hebdo" | "mensuelle";
  nextRefreshAt: string | null;
  lastRefreshAt: string | null;
  refreshing: boolean;
  shareData: boolean;
  lastChanges: { nouveau: number; modifie: number; nonRetrouve: number } | null;
};

type Filter = "" | Row["status"] | "changements";

const CHANGE_BADGE: Record<NonNullable<Row["change"]>, { label: string; cls: string }> = {
  nouveau: { label: "Nouveau", cls: "bg-accent-soft text-accent" },
  modifie: { label: "Modifié", cls: "bg-warn-soft text-warn" },
  non_retrouve: { label: "Non retrouvée", cls: "bg-surface-2 text-muted" },
};

const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function changesText(ch: NonNullable<Collecte["lastChanges"]>) {
  const parts = [
    ch.nouveau && `${ch.nouveau} nouvelle(s)`,
    ch.modifie && `${ch.modifie} modifiée(s)`,
    ch.nonRetrouve && `${ch.nonRetrouve} non retrouvée(s)`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "aucun changement";
}

/** Réglage de la mise à jour automatique et bilan de la dernière. */
function RefreshPanel({
  collecte,
  options,
  onChange,
  onShare,
  onShowChanges,
}: {
  collecte: Collecte;
  options: string[];
  onChange: (refresh: Collecte["refresh"]) => Promise<string | null>;
  onShare: (share: boolean) => Promise<string | null>;
  onShowChanges: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ch = collecte.lastChanges;
  const changed = ch ? ch.nouveau + ch.modifie + ch.nonRetrouve : 0;
  const choices = [
    { v: "aucune", l: "Jamais" },
    { v: "hebdo", l: "Chaque semaine" },
    { v: "mensuelle", l: "Chaque mois" },
  ] as const;

  return (
    <section className="card flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
      <RefreshCw className={`size-5 shrink-0 ${collecte.refresh !== "aucune" ? "text-accent" : "text-muted"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">Mise à jour automatique</p>
        <p className="text-xs text-muted">
          {collecte.refreshing
            ? "Mise à jour en cours : tes lignes restent consultables."
            : collecte.refresh !== "aucune" && collecte.nextRefreshAt
              ? `Prochaine le ${dateFr(collecte.nextRefreshAt)}. Les nouveautés et les changements seront marqués, tes validations gardées.`
              : "Luka relance la recherche et te signale les nouvelles lignes et les changements."}
          {ch && collecte.lastRefreshAt && !collecte.refreshing && (
            <>
              {" "}
              Dernière le {dateFr(collecte.lastRefreshAt)} : {changesText(ch)}.
              {changed > 0 && (
                <button type="button" className="ml-1 font-medium text-accent hover:underline" onClick={onShowChanges}>
                  Voir les changements
                </button>
              )}
            </>
          )}
        </p>
        {err && <p className="mt-1 text-xs text-danger">{err}</p>}
        <label className="mt-2 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--accent)]"
            checked={collecte.shareData}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              setErr(await onShare(e.target.checked));
              setBusy(false);
            }}
          />
          Partager les lignes validées avec la base Luka (informations publiques d&apos;établissements uniquement)
        </label>
      </div>
      <select
        className="input w-auto py-1.5 text-[13px]"
        aria-label="Fréquence de mise à jour"
        value={collecte.refresh}
        disabled={busy || collecte.refreshing}
        onChange={async (e) => {
          setBusy(true);
          setErr(await onChange(e.target.value as Collecte["refresh"]));
          setBusy(false);
        }}
      >
        {choices.map((c) => (
          <option key={c.v} value={c.v} disabled={c.v !== "aucune" && !options.includes(c.v)}>
            {c.l}
            {c.v !== "aucune" && !options.includes(c.v) ? " (Premium)" : ""}
          </option>
        ))}
      </select>
    </section>
  );
}

const ROW_STATUS: Record<Row["status"], { label: string; cls: string }> = {
  a_verifier: { label: "À vérifier", cls: "" },
  valide: { label: "Validée", cls: "bg-accent-soft/40" },
  rejete: { label: "Rejetée", cls: "opacity-45 [&_td:not(:last-child)]:line-through" },
};

function formatValue(v: Row["data"][string], type: string) {
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  // Lien vers une photo : miniature cliquable
  if (typeof v === "string" && /^https?:\/\/.*(googleusercontent\.com|\.(jpe?g|png|webp)(\?|$))/i.test(v))
    return (
      <a href={v} target="_blank" rel="noopener noreferrer" className="block size-12 overflow-hidden rounded-md bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- images externes de tailles variées, chargées à la demande */}
        <img src={v} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
      </a>
    );
  if (type === "url" && typeof v === "string" && /^https?:\/\//.test(v))
    return (
      <a href={v} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
        {v.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
      </a>
    );
  if (typeof v === "number") return v.toLocaleString("fr-FR");
  return String(v);
}

function Confidence({ value }: { value: number | null }) {
  if (value === null) return null;
  const pct = Math.round(value * 100);
  const color = value >= 0.7 ? "bg-accent" : value >= 0.45 ? "bg-warn" : "bg-danger";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={`Confiance : ${pct} %`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-surface-2">
        <span className={`block h-full ${color}`} style={{ width: `${pct}%` }} />
      </span>
      {pct}%
    </span>
  );
}

export function CollecteView({ id }: { id: string }) {
  const router = useRouter();
  const [collecte, setCollecte] = useState<Collecte | null>(null);
  const [counts, setCounts] = useState<Counts>({ total: 0, valide: 0, a_verifier: 0, rejete: 0 });
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [data, setData] = useState<Page | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [editing, setEditing] = useState<{ rowId: string; col: string; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<Row["status"] | null>(null);
  const [filter, setFilter] = useState<Filter>("");
  const [refreshOptions, setRefreshOptions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // recherche envoyée au serveur (après une courte pause de frappe)
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const tableTop = useRef<HTMLDivElement>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/collectes/${id}`);
    if (!res.ok) return setError("Impossible de charger la collecte");
    const json = await res.json();
    setCollecte(json.collecte);
    setCounts(json.counts);
    setQueuePosition(json.queuePosition);
    setRefreshOptions(json.refreshOptions ?? []);
  }, [id]);

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    const sp = new URLSearchParams({ page: String(page), size: String(size) });
    if (filter) sp.set("statut", filter);
    if (query) sp.set("q", query);
    const res = await fetch(`/api/collectes/${id}/rows?${sp}`);
    setLoadingRows(false);
    if (!res.ok) return setError("Impossible de charger les lignes");
    setData(await res.json());
  }, [id, page, size, filter, query]);

  const active = collecte?.status === "pending" || collecte?.status === "running";
  const finished = collecte !== null && !active;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    loadMeta();
  }, [loadMeta]);

  // Les lignes sont enregistrées à la fin de la collecte : on les charge une fois terminée
  // (pendant une mise à jour automatique, les lignes existantes restent affichées)
  const refreshing = collecte?.refreshing ?? false;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement de la page demandée
    if (finished || refreshing) loadRows();
  }, [finished, refreshing, loadRows]);

  // Suivi en direct tant que la collecte est dans la file ou en cours
  useEffect(() => {
    if (!active) return;
    const t = setInterval(loadMeta, 2000);
    return () => clearInterval(t);
  }, [active, loadMeta]);

  // Recherche : on attend la fin de la frappe, puis on revient à la première page
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function goTo(p: number) {
    setPage(p);
    tableTop.current?.scrollIntoView({ block: "nearest" });
  }

  async function patchRow(rowId: string, body: object) {
    const res = await fetch(`/api/rows/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return setError("Modification impossible");
    const { row } = await res.json();
    setData((d) => d && { ...d, rows: d.rows.map((r) => (r.id === rowId ? row : r)) });
    if ("status" in body) loadMeta();
  }

  async function bulk(status: Row["status"]) {
    setConfirmBulk(null);
    const res = await fetch(`/api/collectes/${id}/rows`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, filtre: { statut: filter || null, q: query || null } }),
    });
    if (!res.ok) return setError("Action groupée impossible");
    await Promise.all([loadMeta(), loadRows()]);
  }

  async function saveEdit() {
    if (!editing || !collecte) return;
    const col = collecte.columns.find((c) => c.name === editing.col);
    const raw = editing.value.trim();
    const value = raw === "" ? null : col?.type === "nombre" && !isNaN(Number(raw.replace(",", "."))) ? Number(raw.replace(",", ".")) : raw;
    await patchRow(editing.rowId, { data: { [editing.col]: value } });
    setEditing(null);
  }

  async function setRefresh(refresh: Collecte["refresh"]) {
    const res = await fetch(`/api/collectes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return (json.error as string) ?? "Réglage impossible";
    setCollecte((c) => c && { ...c, refresh: json.refresh, nextRefreshAt: json.nextRefreshAt });
    return null;
  }

  async function setShare(shareData: boolean) {
    const res = await fetch(`/api/collectes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareData }),
    });
    if (!res.ok) return "Réglage impossible";
    setCollecte((c) => c && { ...c, shareData });
    return null;
  }

  async function remove() {
    if (!collecte) return;
    const res = await fetch(`/api/collectes/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/tableau-de-bord");
      router.refresh();
    } else setError("Suppression impossible");
  }

  if (error && !collecte) return <p className="text-danger">{error}</p>;
  if (!collecte)
    return (
      <p className="flex items-center gap-2 text-muted">
        <Loader2 className="size-4 animate-spin" /> Chargement…
      </p>
    );

  const lastLog = collecte.log.at(-1);
  // Enrichissement : les colonnes ajoutées par Luka sont distinguées de celles du fichier
  const enrich = collecte.kind === "enrichissement";
  const visible = data?.rows ?? [];
  const matching = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(matching / size));
  const from = matching ? (page - 1) * size + 1 : 0;
  const to = Math.min(page * size, matching);
  const filtered = Boolean(filter || query);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <nav className="flex items-center gap-1 text-xs text-muted" aria-label="Fil d'Ariane">
          <Link href="/tableau-de-bord" className="hover:text-text">Mes collectes</Link>
          <ChevronRight className="size-3" />
          <span className="truncate text-text">{collecte.title}</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight">{collecte.title}</h1>
              <StatusBadge status={collecte.status} />
            </div>
            <p className="mt-1 max-w-2xl text-[13px] text-muted">{collecte.request}</p>
          </div>
          {!active && counts.total > 0 && (
            <div className="flex flex-wrap gap-2">
              {counts.valide > 0 && (
                <a className="btn-ghost" href={`/api/collectes/${id}/export?format=csv&valides=1`}>
                  <CheckCheck className="size-4" /> CSV validées
                </a>
              )}
              <a className="btn-ghost" href={`/api/collectes/${id}/export?format=json`}>
                <FileJson className="size-4" /> JSON
              </a>
              <a className="btn-primary" href={`/api/collectes/${id}/export?format=csv`}>
                <Download className="size-4" /> Exporter CSV
              </a>
            </div>
          )}
        </div>
      </div>

      {collecte.status === "pending" && (
        <div className="card flex items-center gap-4 p-4">
          <Clock className="size-5 shrink-0 text-muted" />
          <div>
            <p className="font-medium">{collecte.refreshing ? "Mise à jour automatique dans la file d'attente" : "Ta collecte est dans la file d'attente"}</p>
            <p className="text-[13px] text-muted">
              {queuePosition && queuePosition > 1
                ? `${queuePosition - 1} collecte(s) avant la tienne. Tu peux fermer cette page : tu seras notifié à la fin.`
                : "Elle démarre dans quelques secondes. Tu peux fermer cette page : tu seras notifié à la fin."}
            </p>
          </div>
        </div>
      )}

      {collecte.status === "running" && (
        <div className="card border-info/30 bg-info-soft p-4">
          <div className="flex items-center gap-4">
            <Loader2 className="size-5 shrink-0 animate-spin text-info" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">{collecte.refreshing ? "Luka met à jour tes données…" : "Luka collecte tes données…"}</p>
                <span className="text-[13px] font-medium tabular-nums text-info">{collecte.progress} %</span>
              </div>
              <p className="truncate text-[13px] text-muted">{lastLog?.message ?? "Démarrage"}</p>
            </div>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={collecte.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avancement de la collecte"
          >
            <div className="h-full rounded-full bg-info transition-[width] duration-500" style={{ width: `${Math.max(collecte.progress, 3)}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">Tu peux fermer cette page : tu seras notifié à la fin.</p>
        </div>
      )}

      {collecte.status === "failed" && (
        <div className="card border-danger/30 bg-danger-soft p-4 text-[13px] text-danger">
          <p className="font-semibold">La collecte a échoué</p>
          <p className="mt-1">{collecte.error}</p>
        </div>
      )}

      {error && <p className="rounded-lg bg-danger-soft px-4 py-3 text-[13px] text-danger">{error}</p>}

      {(collecte.status === "done" || collecte.refreshing) && counts.total > 0 && (
        <RefreshPanel
          collecte={collecte}
          options={refreshOptions}
          onChange={setRefresh}
          onShare={setShare}
          onShowChanges={() => {
            setFilter("changements");
            setPage(1);
            tableTop.current?.scrollIntoView({ block: "start", behavior: "smooth" });
          }}
        />
      )}

      {counts.total > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Lignes trouvées" value={fmt(counts.total)} icon={Database} hint={`${collecte.columns.length} colonne(s)`} />
            <StatCard label="Validées" value={fmt(counts.valide)} icon={Check} tone="accent" hint="Prêtes à exporter" />
            <StatCard label="À vérifier" value={fmt(counts.a_verifier)} icon={CircleDashed} hint="Vérifie la source de chaque ligne" />
            <StatCard label="Rejetées" value={fmt(counts.rejete)} icon={X} hint="Exclues des exports" />
          </div>

          <section className="card overflow-hidden" ref={tableTop}>
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
              <div className="mr-auto">
                <h2 className="text-[15px] font-semibold">Résultats</h2>
                <p className="text-xs text-muted">Double-clique sur une case pour la corriger.</p>
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher"
                  aria-label="Rechercher dans les résultats"
                  className="input py-1.5 pl-8 text-[13px]"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value as typeof filter);
                  setPage(1);
                }}
                className="input w-auto py-1.5 text-[13px]"
                aria-label="Filtrer par vérification"
              >
                <option value="">Toutes les lignes</option>
                <option value="a_verifier">À vérifier</option>
                <option value="valide">Validées</option>
                <option value="rejete">Rejetées</option>
                {collecte.lastChanges && <option value="changements">Changements (dernière mise à jour)</option>}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/40 px-5 py-2 text-xs text-muted">
              <span className="mr-auto">
                {loadingRows && <Loader2 className="mr-1.5 inline size-3 animate-spin" />}
                {fmt(matching)} ligne(s) {filtered ? "correspondent au filtre" : "au total"}
              </span>
              {matching > 0 &&
                (confirmBulk ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {confirmBulk === "valide" ? "Valider" : "Rejeter"} {fmt(matching)} ligne(s) ?
                    <button className="rounded-md border border-border px-2 py-1 hover:text-text" onClick={() => setConfirmBulk(null)}>
                      Annuler
                    </button>
                    <button
                      className={`rounded-md px-2 py-1 font-medium text-white ${confirmBulk === "valide" ? "bg-accent" : "bg-danger"}`}
                      onClick={() => bulk(confirmBulk)}
                    >
                      Confirmer
                    </button>
                  </span>
                ) : (
                  <>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-accent hover:text-accent"
                      onClick={() => setConfirmBulk("valide")}
                    >
                      <CheckCheck className="size-3.5" /> Tout valider
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-danger hover:text-danger"
                      onClick={() => setConfirmBulk("rejete")}
                    >
                      <X className="size-3.5" /> Tout rejeter
                    </button>
                  </>
                ))}
            </div>

            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead className="sticky top-0 z-10 bg-surface-2 text-left text-xs text-muted">
                  <tr>
                    {collecte.columns.map((c) => (
                      <th
                        key={c.name}
                        title={enrich ? (c.fromFile ? "Colonne de ton fichier" : "Ajoutée par Luka") : undefined}
                        className={`px-4 py-2.5 font-medium first:pl-5 ${enrich && !c.fromFile ? "text-accent" : ""}`}
                      >
                        {c.label}
                        {enrich && !c.fromFile && <span className="ml-1 text-[10px] font-semibold">+</span>}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-medium">Source</th>
                    <th className="px-4 py-2.5 font-medium">Confiance</th>
                    <th className="px-5 py-2.5 text-right font-medium">Vérification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visible.map((r) => (
                    <tr key={r.id} className={ROW_STATUS[r.status].cls}>
                      {collecte.columns.map((c) => (
                        <td
                          key={c.name}
                          className="max-w-xs px-4 py-3 align-top first:pl-5 first:font-medium"
                          onDoubleClick={() =>
                            setEditing({ rowId: r.id, col: c.name, value: r.data[c.name] === null ? "" : String(r.data[c.name]) })
                          }
                        >
                          {editing?.rowId === r.id && editing.col === c.name ? (
                            <input
                              autoFocus
                              className="input py-1"
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onBlur={saveEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") setEditing(null);
                              }}
                            />
                          ) : (
                            <>
                              {formatValue(r.data[c.name], c.type)}
                              {r.previous && c.name in r.previous && (
                                <span className="mt-0.5 block text-xs text-muted line-through" title="Valeur avant la dernière mise à jour">
                                  {r.previous[c.name] === null || r.previous[c.name] === "" ? "vide" : String(r.previous[c.name])}
                                </span>
                              )}
                              {r.change && c.name === collecte.columns[0].name && (
                                <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${CHANGE_BADGE[r.change].cls}`}>
                                  {CHANGE_BADGE[r.change].label}
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      ))}
                      <td className="max-w-[180px] px-4 py-3 align-top">
                        {r.sourceUrl ? (
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-accent hover:underline"
                            title={r.sourceTitle ?? r.sourceUrl}
                          >
                            {new URL(r.sourceUrl).hostname.replace(/^www\./, "")}
                          </a>
                        ) : (
                          <span className="text-xs text-warn">{r.sourceTitle ?? "Sans source"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top"><Confidence value={r.confidence} /></td>
                      <td className="px-5 py-3 align-top">
                        <div className="flex justify-end gap-1">
                          <button
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${r.status === "valide" ? "bg-accent text-accent-text" : "border border-border text-muted hover:border-accent hover:text-accent"}`}
                            onClick={() => patchRow(r.id, { status: r.status === "valide" ? "a_verifier" : "valide" })}
                            aria-pressed={r.status === "valide"}
                          >
                            <Check className="size-3.5" /> Valider
                          </button>
                          <button
                            className={`grid size-7 place-items-center rounded-md ${r.status === "rejete" ? "bg-danger text-white" : "border border-border text-muted hover:border-danger hover:text-danger"}`}
                            onClick={() => patchRow(r.id, { status: r.status === "rejete" ? "a_verifier" : "rejete" })}
                            aria-pressed={r.status === "rejete"}
                            aria-label="Rejeter la ligne"
                            title="Rejeter"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && !loadingRows && (
                    <tr>
                      <td colSpan={collecte.columns.length + 3} className="px-5 py-10 text-center text-muted">
                        Aucune ligne ne correspond à ce filtre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <nav className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3 text-xs text-muted" aria-label="Pagination">
              <span className="tabular-nums">
                {fmt(from)}–{fmt(to)} sur {fmt(matching)}
              </span>
              <label className="flex items-center gap-1.5">
                Par page
                <select
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="input w-auto py-1 text-xs"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <div className="ml-auto flex items-center gap-1">
                <PageButton label="Première page" disabled={page <= 1} onClick={() => goTo(1)}><ChevronsLeft className="size-4" /></PageButton>
                <PageButton label="Page précédente" disabled={page <= 1} onClick={() => goTo(page - 1)}><ChevronLeft className="size-4" /></PageButton>
                <span className="px-2 tabular-nums">
                  Page{" "}
                  <input
                    key={page}
                    type="number"
                    min={1}
                    max={pages}
                    defaultValue={page}
                    aria-label="Aller à la page"
                    className="input inline-block w-14 px-1.5 py-1 text-center text-xs"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const n = Math.min(Math.max(Number(e.currentTarget.value) || 1, 1), pages);
                      goTo(n);
                    }}
                  />{" "}
                  sur {fmt(pages)}
                </span>
                <PageButton label="Page suivante" disabled={page >= pages} onClick={() => goTo(page + 1)}><ChevronRight className="size-4" /></PageButton>
                <PageButton label="Dernière page" disabled={page >= pages} onClick={() => goTo(pages)}><ChevronsRight className="size-4" /></PageButton>
              </div>
            </nav>
          </section>
        </>
      )}

      {!active && counts.total === 0 && collecte.status === "done" && (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="icon-box size-11"><Search className="size-5" /></span>
          <p className="mt-4 font-semibold">Aucune donnée trouvée</p>
          <p className="mt-1 text-[13px] text-muted">Essaie de reformuler ta demande de façon plus précise.</p>
        </div>
      )}

      <details className="card group">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="text-[15px] font-semibold">Journal de la collecte</span>
          <span className="flex items-center gap-2 text-xs text-muted">
            {!active && `${collecte.llmCalls} appel(s) IA · ${collecte.tokensUsed.toLocaleString("fr-FR")} tokens · `}
            {!active && collecte.tier === "premium" && `sources payantes : ${collecte.costUsd.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} $ · `}
            {collecte.log.length} étape(s)
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
          </span>
        </summary>
        <ol className="space-y-1.5 border-t border-border px-5 py-4 font-mono text-xs">
          {collecte.log.map((l, i) => (
            <li key={i} className={l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warn" : "text-muted"}>
              <span className="mr-2 opacity-60">{new Date(l.at).toLocaleTimeString("fr-FR")}</span>
              {l.message}
            </li>
          ))}
        </ol>
      </details>

      {collecte.status !== "running" && !collecte.refreshing && (
        <div className="flex justify-end">
          {confirmDelete ? (
            <span className="flex flex-wrap items-center gap-2 text-[13px]">
              {collecte.status === "pending" ? "Annuler et supprimer cette collecte ?" : "Supprimer définitivement cette collecte ?"}
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Annuler</button>
              <button className="btn bg-danger text-white hover:opacity-90" onClick={remove}>Oui, supprimer</button>
            </span>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> {collecte.status === "pending" ? "Annuler la collecte" : "Supprimer la collecte"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PageButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md border border-border hover:text-text disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
