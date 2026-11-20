import { Suspense } from "react";
import { AdminFrame } from "@/components/admin/admin-frame";
import { requireConsoleAdmin } from "@/lib/auth";

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireConsoleAdmin();
  return <AdminFrame user={{ name: user.name, email: user.email, image: user.image }}>{children}</AdminFrame>;
}

function ShellFallback() {
  return (
    <div className="flex min-h-screen lg:p-2">
      <aside className="hidden w-[232px] shrink-0 lg:block" />
      <div className="flex-1 bg-surface lg:rounded-xl lg:border lg:border-border">
        <div className="h-12 border-b border-border" />
      </div>
    </div>
  );
}

export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
