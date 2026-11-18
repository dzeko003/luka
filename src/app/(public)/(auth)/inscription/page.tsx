import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSession, googleEnabled } from "@/lib/auth";
import { limits } from "@/lib/config";

export const metadata: Metadata = { title: "Inscription" };

export default async function Page({ searchParams }: PageProps<"/inscription">) {
  const sp = await searchParams;
  const demande = typeof sp.demande === "string" ? sp.demande.trim().slice(0, 2000) : "";
  const email = typeof sp.email === "string" ? sp.email.slice(0, 200) : undefined;
  // Une demande tapée sur l'accueil est reprise dans le formulaire de collecte après l'inscription
  const next = demande ? `/collectes/nouvelle?demande=${encodeURIComponent(demande)}` : "/tableau-de-bord";
  if (await getSession()) redirect(next);
  return (
    <AuthShell
      photo="/landing/etudiante-laptop.webp"
      photoAlt="Une étudiante travaille sur son ordinateur portable"
      photoPosition="35% center"
      title="Décris les données. Luka remplit le tableau."
      points={[`${limits.free.collectesPerDay} collectes gratuites par jour`, "La source de chaque ligne", "Premium bientôt disponible"]}
    >
      <AuthForm mode="inscription" googleEnabled={googleEnabled} defaultEmail={email} next={next} />
    </AuthShell>
  );
}
