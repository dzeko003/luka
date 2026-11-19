import type { Metadata } from "next";
import { headers } from "next/headers";
import { AccountSettings } from "@/components/account-settings";
import { auth, googleEnabled, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Mon compte" };

export default async function Page({ searchParams }: PageProps<"/compte">) {
  const user = await requireUser();
  const h = await headers();
  const [accounts, sessions, sp] = await Promise.all([auth.api.listUserAccounts({ headers: h }), auth.api.listSessions({ headers: h }), searchParams]);
  const providers = accounts.map((a) => a.providerId);
  const google = accounts.find((a) => a.providerId === "google");
  return (
    <AccountSettings
      user={{ name: user.name, email: user.email, emailVerified: user.emailVerified, premium: user.plan === "premium" }}
      hasPassword={providers.includes("credential")}
      googleAccountId={google?.accountId ?? null}
      googleEnabled={googleEnabled}
      otherSessions={Math.max(0, sessions.length - 1)}
      linkError={typeof sp.error === "string" ? sp.error.slice(0, 80) : undefined}
      linked={sp.google === "relie"}
    />
  );
}
