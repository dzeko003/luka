import { count, desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { int } from "@/components/admin/format";
import { KbTable } from "@/components/admin/kb-table";
import { PageTitle } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { requireConsoleAdmin } from "@/lib/auth";
import { kbSearch } from "@/lib/kb";

export const metadata: Metadata = { title: "Base Luka" };

export default async function Page({ searchParams }: PageProps<"/admin/base">) {
  await requireConsoleAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const e = schema.kbEntities;
  const [[{ total }], cities, rows] = await Promise.all([
    db.select({ total: count() }).from(e),
    db.select({ city: e.city, n: count() }).from(e).groupBy(e.city).orderBy(desc(count())).limit(6),
    kbSearch(query, 100),
  ]);
  const [{ shared }] = await db.select({ shared: sql<number>`count(*) filter (where ${schema.collectes.shareData})`.mapWith(Number) }).from(schema.collectes);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle title="Base Luka" count={total}>
        Établissements connus, réutilisés par les collectes. Alimentée par les lignes validées de {int(shared)} collecte(s) partagée(s) et par les
        contributions acceptées.{" "}
        {cities.length > 0 && `Villes : ${cities.map((c) => `${c.city} (${int(c.n)})`).join(", ")}.`}
      </PageTitle>
      <Suspense>
        <KbTable
          rows={rows.map((r) => ({
            id: r.id,
            name: r.name,
            city: r.city,
            category: r.category,
            confirmations: r.confirmations,
            updatedAt: r.updatedAt.toISOString(),
            fields: r.fields,
          }))}
        />
      </Suspense>
    </div>
  );
}
