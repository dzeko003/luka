import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AdminMfaSetup } from "@/components/admin/admin-mfa-setup";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { AdminMark } from "@/components/admin/ui";
import { auth, getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Double authentification" };

/** Première activation de Google Authenticator, obligatoire pour la console. */
export default async function Page() {
  const s = await getSession();
  if (!s) redirect("/admin/connexion");
  if (s.user.role !== "admin" || s.user.blocked) notFound();
  if (s.user.twoFactorEnabled) redirect(s.session.mfaVerified ? "/admin" : "/admin/connexion?session=1");
  const accounts = await auth.api.listUserAccounts({ headers: await headers() });
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <ThemeToggle className="absolute top-4 right-4" />
      <AdminMark size="md" />
      <AdminMfaSetup hasPassword={accounts.some((a) => a.providerId === "credential")} />
    </div>
  );
}
