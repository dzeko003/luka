import type { Metadata } from "next";
import { EnrichForm } from "@/components/enrich-form";
import { requireUser } from "@/lib/auth";
import { tierLimits } from "@/lib/config";
import { loadSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Compléter un fichier" };

export default async function Page() {
  const user = await requireUser();
  await loadSettings();
  return <EnrichForm maxRows={tierLimits(user.plan).maxEnrichRows} premium={user.plan === "premium"} />;
}
