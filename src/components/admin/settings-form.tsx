"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { alertCls, btn, btnGhost, field, panel } from "./ui";

export type SettingRow = {
  key: string;
  group: "ia" | "tavily" | "apify";
  label: string;
  help: string;
  min: number;
  max: number;
  integer: boolean;
  unit?: string;
  value: number;
  def: number;
  updatedAt: string | null;
};

const GROUPS: { id: SettingRow["group"]; title: string; text: string }[] = [
  { id: "ia", title: "Plafond IA", text: "Limite commune à tous les utilisateurs, remise à zéro chaque jour à minuit (UTC)." },
  { id: "tavily", title: "Recherche web (Tavily)", text: "Chaque recherche consomme un crédit Tavily, et les pages trouvées sont lues par l'IA." },
  { id: "apify", title: "Apify (Premium)", text: "Google Maps, pages Facebook et comptes Instagram publics, facturés à l'usage." },
];

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Formulaire des réglages : seules les valeurs modifiées sont envoyées. */
export function SettingsForm({ rows }: { rows: SettingRow[] }) {
  const router = useRouter();
  const initial = Object.fromEntries(rows.map((r) => [r.key, String(r.value)]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const changed = rows.filter((r) => values[r.key] !== initial[r.key]);

  async function save(payload: Record<string, number | null>) {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/reglages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values: payload }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return setError(body?.error ?? "L'enregistrement a échoué.");
    }
    setSaved(true);
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, number | null> = {};
    for (const r of changed) {
      const n = Number(values[r.key].replace(",", "."));
      if (values[r.key].trim() === "" || !Number.isFinite(n)) return setError(`${r.label} : nombre attendu.`);
      payload[r.key] = n;
    }
    void save(payload);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {GROUPS.map((g) => (
        <section key={g.id} className={`${panel} p-4`}>
          <h2 className="text-[14px] font-semibold">{g.title}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{g.text}</p>
          <div className="mt-4 divide-y divide-border">
            {rows
              .filter((r) => r.group === g.id)
              .map((r) => {
                const custom = r.value !== r.def;
                return (
                  <div key={r.key} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_200px] sm:items-center sm:gap-6">
                    <div className="min-w-0">
                      <label htmlFor={r.key} className="text-[13px] font-medium">
                        {r.label}
                      </label>
                      <p className="text-[12.5px] text-muted">
                        {r.help} Défaut : {fmt(r.def)}
                        {r.unit === "$" ? " $" : ""}.
                        {custom && r.updatedAt && ` Modifié le ${new Date(r.updatedAt).toLocaleDateString("fr-FR")}.`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="relative min-w-0 flex-1">
                        <input
                          id={r.key}
                          inputMode={r.integer ? "numeric" : "decimal"}
                          className={`${field} pr-16 tabular-nums`}
                          value={values[r.key]}
                          onChange={(e) => setValues({ ...values, [r.key]: e.target.value })}
                        />
                        {r.unit && (
                          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[12.5px] text-muted">{r.unit}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={busy || !custom}
                        onClick={() => void save({ [r.key]: null })}
                        aria-label={`Revenir à la valeur par défaut : ${r.label}`}
                        title="Revenir à la valeur par défaut"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}

      {error && <p className={alertCls}>{error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" className={btn} disabled={busy || changed.length === 0}>
          {busy ? "Enregistrement…" : changed.length > 1 ? `Enregistrer ${changed.length} modifications` : "Enregistrer"}
        </button>
        {saved && changed.length === 0 && (
          <span className="text-[12.5px] text-muted">Enregistré. Les collectes en attente l&apos;appliquent dans les 30 secondes.</span>
        )}
      </div>
    </form>
  );
}
