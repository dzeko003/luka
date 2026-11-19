import type { Metadata } from "next";
import { CollecteList } from "@/components/admin/collecte-list";
import { PageTitle } from "@/components/admin/ui";
import { listCollectes } from "@/lib/admin-stats";
import { requireConsoleAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Collectes" };

export default async function Page() {
  await requireConsoleAdmin();
  const collectes = await listCollectes({ limit: 150 });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageTitle title="Collectes" count={collectes.length}>
        Les 150 plus récentes, tous utilisateurs confondus. Clique sur une collecte pour voir la demande et les colonnes.
      </PageTitle>
      <CollecteList collectes={collectes} />
    </div>
  );
}
