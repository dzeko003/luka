"use client";

import { Database, ExternalLink, HeartHandshake, LayoutDashboard, ListChecks, LogOut, Menu, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";
import { AdminMark, Avatar } from "./ui";

const nav = [
  { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users },
  { href: "/admin/collectes", label: "Collectes", icon: ListChecks },
  { href: "/admin/contributions", label: "Contributions", icon: HeartHandshake },
  { href: "/admin/base", label: "Base Luka", icon: Database },
  { href: "/admin/reglages", label: "Réglages", icon: SlidersHorizontal },
];

const isActive = (href: string, pathname: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

/** Cadre de l'administration : barre latérale (sections, compte, thème) et fil d'Ariane, comme la maquette « User management ». */
export function AdminFrame({ user, children }: { user: { name: string; email: string; image?: string | null }; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = nav.find((n) => isActive(n.href, pathname)) ?? nav[0];
  const CurrentIcon = current.icon;

  async function signOut() {
    await authClient.signOut();
    router.push("/admin/connexion");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-5 px-3 py-4">
      <div className="px-1.5 pt-0.5">
        <AdminMark />
      </div>

      <nav aria-label="Administration" className="space-y-0.5">
        <p className="px-2 pb-1 text-[11.5px] text-muted">Général</p>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors ${
                active ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Raccourcis" className="space-y-0.5">
        <p className="px-2 pb-1 text-[11.5px] text-muted">Raccourcis</p>
        <Link
          href="/tableau-de-bord"
          target="_blank"
          className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted hover:bg-surface-2 hover:text-text"
        >
          <ExternalLink className="size-4" />
          Ouvrir Luka côté client
        </Link>
      </nav>

      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2 py-0.5 text-[11.5px] text-muted">
            <ShieldCheck className="size-3.5 text-success" /> Double authentification
          </span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border px-2 py-2">
          <Avatar name={user.name || user.email} image={user.image} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium">{user.name}</p>
            <p className="truncate text-[11.5px] text-muted">{user.email}</p>
          </div>
          <button
            onClick={signOut}
            aria-label="Se déconnecter"
            title="Se déconnecter"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen lg:p-2">
      <aside className="sticky top-2 hidden h-[calc(100vh-16px)] w-[232px] shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Fermer le menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-[260px] border-r border-border bg-bg">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col bg-surface lg:rounded-xl lg:border lg:border-border">
        <header className="flex h-12 items-center gap-2 border-b border-border px-4">
          <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="-ml-1.5 grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 lg:hidden">
            <Menu className="size-4" />
          </button>
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[12.5px]">
            <span className="text-muted">Admin</span>
            <span className="text-muted">/</span>
            <Link href={current.href} className="inline-flex items-center gap-1.5 font-medium">
              <CurrentIcon className="size-3.5 text-muted" />
              {current.label}
            </Link>
          </nav>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
