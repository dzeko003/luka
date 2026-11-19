import type { Metadata } from "next";
import { Suspense } from "react";
import { themeScript } from "@/components/admin/theme";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin Luka" },
  robots: { index: false, follow: false },
};

/** Administration : thème à part (clair ou sombre), en dehors de l'application. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="admin min-h-screen text-sm antialiased" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <Suspense>{children}</Suspense>
    </div>
  );
}
