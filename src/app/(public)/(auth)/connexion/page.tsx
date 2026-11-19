import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSession, googleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function Page({ searchParams }: PageProps<"/connexion">) {
  const sp = await searchParams;
  const demande = typeof sp.demande === "string" ? sp.demande.trim().slice(0, 2000) : "";
  const email = typeof sp.email === "string" ? sp.email.slice(0, 200) : undefined;
  // Une demande tapée sur l'accueil est reprise dans le formulaire de collecte après l'inscription
  const next = demande ? `/collectes/nouvelle?demande=${encodeURIComponent(demande)}` : "/tableau-de-bord";
  if (await getSession()) redirect(next);
  return (
    <AuthShell
      photo="/landing/chercheuse-labo.webp"
      photoAlt="Une chercheuse travaille dans un laboratoire"
      photoPosition="center 20%"
      title="Tes collectes t'attendent, avec leurs sources."
      points={["Reprends là où tu t'étais arrêté", "Vérifie, corrige et valide tes lignes", "Exporte en CSV (Excel) ou en JSON"]}
    >
      <AuthForm
        mode="connexion"
        googleEnabled={googleEnabled}
        defaultEmail={email}
        next={next}
        authError={typeof sp.error === "string" ? sp.error.slice(0, 80) : undefined}
      />
    </AuthShell>
  );
}
