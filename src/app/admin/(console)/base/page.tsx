import { count, desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { int } from "@/components/admin/format";
import { KbTable } from "@/components/admin/kb-table";
import { PageTitle } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { requireConsoleAdmin } from "@/lib/auth";
import { ENTITY_TYPES, kbSearch } from "@/lib/kb";
import { ENTITY_LABELS, isEntityType } from "@/lib/kb-fields";

export const metadata: Metadata = { title: "Base Luka" };

export default async function Page({ searchParams }: PageProps<"/admin/base">) {
  await requireConsoleAdmin();
  const { q, type } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const kind = isEntityType(type) ? type : undefined;
  const e = schema.entities;
  const [byType, cities, rows] = await Promise.all([
    db.select({ type: e.type, n: count() }).from(e).groupBy(e.type),
    db.select({ city: e.city, n: count() }).from(e).where(eq(e.type, "lieu")).groupBy(e.city).orderBy(desc(count())).limit(6),
    kbSearch(query, 100, kind),
  ]);
  const counts = Object.fromEntries(byType.map((t) => [t.type, t.n]));
  const total = byType.reduce((n, t) => n + t.n, 0);
  const [{ shared }] = await db.select({ shared: sql<number>`count(*) filter (where ${schema.collectes.shareData})`.mapWith(Number) }).from(schema.collectes);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle title="Base Luka" count={total}>
        Fiches communes réutilisées par les collectes :{" "}
        {ENTITY_TYPES.map((t) => `${ENTITY_LABELS[t].many.toLowerCase()} (${int(counts[t] ?? 0)})`).join(", ")}. Les lieux viennent des lignes
        validées de {int(shared)} collecte(s) partagée(s) et des contributions acceptées.{" "}
        {cities.length > 0 && `Villes : ${cities.map((c) => `${c.city} (${int(c.n)})`).join(", ")}.`}
      </PageTitle>
      <Suspense>
        <KbTable
          type={kind ?? null}
          counts={counts}
          rows={rows.map(({ entity: r, links }) => ({
            id: r.id,
            type: r.type,
            name: r.name,
            city: r.city,
            category: r.category,
            confirmations: r.confirmations,
            links,
            updatedAt: r.updatedAt.toISOString(),
            fields: r.fields,
          }))}
        />
      </Suspense>
    </div>
  );
}
