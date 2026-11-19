import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/password-reset-form";

export const metadata: Metadata = { title: "Nouveau mot de passe", referrer: "no-referrer" };

export default async function Page({ searchParams }: PageProps<"/nouveau-mot-de-passe">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.slice(0, 200) : undefined;
  return (
    <AuthShell
      photo="/landing/chercheuse-labo.webp"
      photoAlt="Une chercheuse travaille dans un laboratoire"
      photoPosition="center 20%"
      title="Tes collectes t'attendent, avec leurs sources."
      points={["Un lien sécurisé, valable 1 heure", "Tes collectes restent intactes", "Toutes tes sessions sont fermées après le changement"]}
    >
      <ResetPasswordForm token={token} linkError={typeof sp.error === "string"} />
    </AuthShell>
  );
}
