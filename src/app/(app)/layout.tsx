import { Suspense } from "react";
import { AppFrame } from "@/components/app-frame";
import { requireUser } from "@/lib/auth";
import { checkCollecteQuota } from "@/lib/quotas";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const quota = await checkCollecteQuota(user);
  return (
    <AppFrame
      user={{ name: user.name, email: user.email, image: user.image, premium: user.plan === "premium", admin: user.role === "admin" }}
      quota={{ used: quota.usedToday, limit: quota.limitPerDay, premium: user.plan === "premium" }}
    >
      {children}
    </AppFrame>
  );
}

function ShellFallback() {
  return (
    <div className="console flex min-h-screen">
      <aside className="hidden w-[232px] shrink-0 border-r border-border bg-bg lg:block" />
      <div className="flex-1">
        <div className="h-14 border-b border-border lg:hidden" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
