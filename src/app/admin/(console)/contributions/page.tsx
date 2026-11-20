import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ContributionReview } from "@/components/admin/contribution-review";
import { PageTitle } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { requireConsoleAdmin } from "@/lib/auth";
import { findByNames, kbKey } from "@/lib/kb";

export const metadata: Metadata = { title: "Contributions" };

const PREVIEW = 20;

export default async function Page() {
  await requireConsoleAdmin();
  const c = schema.contributions;
  const list = await db
    .select({ c, userEmail: schema.user.email })
    .from(c)
    .innerJoin(schema.user, eq(schema.user.id, c.userId))
    // Les contributions à vérifier d'abord, puis les plus récentes
    .orderBy(sql`${c.status} = 'pending' desc`, desc(c.createdAt))
    .limit(100);

  const items = await Promise.all(
    list.map(async ({ c: x, userEmail }) => {
      const preview = x.rows.slice(0, PREVIEW);
      let known = 0;
      if (x.status === "pending") {
        const found = await findByNames(x.city, preview.map((r) => r.nom ?? ""));
        known = preview.filter((r) => found.has(kbKey(r.nom ?? "", r.ville || x.city))).length;
      }
      return {
        id: x.id,
        title: x.title,
        description: x.description,
        city: x.city,
        category: x.category,
        fileName: x.fileName,
        rowCount: x.rowCount,
        status: x.status,
        added: x.added,
        updated: x.updated,
        reviewNote: x.reviewNote,
        createdAt: x.createdAt.toISOString(),
        userEmail,
        preview,
        known,
      };
    }),
  );
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle title="Contributions" count={pending}>
        Fichiers envoyés par les utilisateurs pour enrichir la base Luka. Rien n&apos;y entre avant ton accord ; vérifie l&apos;origine et l&apos;absence de
        données sur des personnes.
      </PageTitle>
      <ContributionReview items={items} />
    </div>
  );
}
