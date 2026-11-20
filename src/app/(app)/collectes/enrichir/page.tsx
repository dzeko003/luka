import type { Metadata } from "next";
import { EnrichForm } from "@/components/enrich-form";
import { requireUser } from "@/lib/auth";
import { tierLimits } from "@/lib/config";

export const metadata: Metadata = { title: "Compléter un fichier" };

export default async function Page() {
  const user = await requireUser();
  return <EnrichForm maxRows={tierLimits(user.plan).maxEnrichRows} premium={user.plan === "premium"} />;
}
