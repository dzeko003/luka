import type { Metadata } from "next";
import { AdminUsers } from "@/components/admin/admin-users";
import { PageTitle } from "@/components/admin/ui";
import { listUsers } from "@/lib/admin-stats";
import { requireConsoleAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Utilisateurs" };

export default async function Page() {
  const admin = await requireConsoleAdmin();
  const rows = await listUsers();
  const premium = rows.filter((r) => r.plan === "premium").length;
  const blocked = rows.filter((r) => r.blocked).length;
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTitle title="Utilisateurs" count={rows.length}>
        Clique sur un nom pour voir ses collectes, ses connexions et ses paiements. {premium} premium · {blocked} bloqué{blocked > 1 ? "s" : ""}.
      </PageTitle>
      <AdminUsers users={rows} currentAdminId={admin.id} />
    </div>
  );
}
