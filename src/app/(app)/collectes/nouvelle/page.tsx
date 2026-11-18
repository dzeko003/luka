import type { Metadata } from "next";
import { NewCollecteForm } from "@/components/new-collecte-form";
import { requireUser } from "@/lib/auth";
import { tierLimits } from "@/lib/config";
import { getTemplate } from "@/lib/templates";

export const metadata: Metadata = { title: "Nouvelle collecte" };

export default async function Page({ searchParams }: PageProps<"/collectes/nouvelle">) {
  const user = await requireUser();
  const { modele, demande } = await searchParams;
  const template = getTemplate(typeof modele === "string" ? modele : undefined);
  // La clé recrée le formulaire quand on choisit un autre modèle dans le menu
  const initialRequest = typeof demande === "string" ? demande.slice(0, 2000) : undefined;
  return (
    <NewCollecteForm
      key={template?.id ?? "vide"}
      maxRows={tierLimits(user.plan).maxRows}
      premium={user.plan === "premium"}
      template={template}
      initialRequest={initialRequest}
    />
  );
}
