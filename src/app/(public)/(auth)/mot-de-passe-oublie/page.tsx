import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/password-reset-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function Page({ searchParams }: PageProps<"/mot-de-passe-oublie">) {
  const sp = await searchParams;
  return (
    <AuthShell
      photo="/landing/chercheuse-labo.webp"
      photoAlt="Une chercheuse travaille dans un laboratoire"
      photoPosition="center 20%"
      title="Tes collectes t'attendent, avec leurs sources."
      points={["Un lien sécurisé, valable 1 heure", "Tes collectes restent intactes", "Toutes tes sessions sont fermées après le changement"]}
    >
      <ForgotPasswordForm defaultEmail={typeof sp.email === "string" ? sp.email.slice(0, 200) : undefined} />
    </AuthShell>
  );
}
