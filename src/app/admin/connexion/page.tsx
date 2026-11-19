import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin/admin-login";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import { AdminMark } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion" };

export default async function Page({ searchParams }: PageProps<"/admin/connexion">) {
  const [s, sp] = await Promise.all([getSession(), searchParams]);
  if (s && s.user.role === "admin" && !s.user.blocked && s.user.twoFactorEnabled && s.session.mfaVerified) redirect("/admin");
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <ThemeToggle className="absolute top-4 right-4" />
      <AdminMark size="md" />
      <AdminLogin
        startAtCode={sp.etape === "code"}
        notice={sp.session === "1" ? "Pour ouvrir l'administration, connecte-toi avec ton mot de passe puis ton code Google Authenticator." : undefined}
      />
    </div>
  );
}
