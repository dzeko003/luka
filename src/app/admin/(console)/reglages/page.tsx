import { gte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { usd } from "@/components/admin/format";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageTitle } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { requireConsoleAdmin } from "@/lib/auth";
import { DEFAULTS, loadSettings, SETTINGS } from "@/lib/settings";

export const metadata: Metadata = { title: "Réglages" };

/** Appels IA du jour (UTC) et dépense Apify des 30 derniers jours. */
function usage() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  return [
    db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.llmUsage)
      .where(gte(schema.llmUsage.createdAt, today))
      .then(([r]) => r.n),
    db
      .select({ usd: sql<number>`coalesce(sum(${schema.collectes.costUsd}), 0)`.mapWith(Number) })
      .from(schema.collectes)
      .where(gte(schema.collectes.createdAt, since30))
      .then(([r]) => r.usd),
  ] as const;
}

export default async function Page() {
  await requireConsoleAdmin();
  await loadSettings(true);
  const [stored, ai, spend] = await Promise.all([db.select().from(schema.settings), ...usage()]);
  const updated = new Map(stored.map((s) => [s.key, s.updatedAt.toISOString()]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Réglages">
        Limites des formules et plafonds de dépense. Aujourd&apos;hui : {ai.toLocaleString("fr-FR")} appel(s) IA. Apify sur 30 jours :{" "}
        {usd(spend)}.
      </PageTitle>
      <SettingsForm
        rows={SETTINGS.map((s) => ({
          key: s.key,
          group: s.group,
          label: s.label,
          help: s.help,
          min: s.min,
          max: s.max,
          integer: s.integer,
          unit: s.unit,
          value: s.get(),
          def: DEFAULTS[s.key],
          updatedAt: updated.get(s.key) ?? null,
        }))}
      />
    </div>
  );
}
