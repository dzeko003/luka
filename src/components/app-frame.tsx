"use client";

import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Hospital,
  FileSpreadsheet,
  House,
  Landmark,
  LifeBuoy,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TEMPLATES, type Template } from "@/lib/templates";
import { Logo, LogoMark } from "./logo";
import { NotificationBell } from "./notification-bell";

const ICONS: Record<Template["icon"], typeof MapPin> = {
  Store,
  MapPin,
  Landmark,
  Building2,
  Briefcase,
  GraduationCap,
  Hospital,
  CalendarDays,
};

type Props = {
  user: { name: string; email: string; image?: string | null; premium?: boolean; admin?: boolean };
  quota: { used: number; limit: number; premium?: boolean };
  children: React.ReactNode;
};

// Entrée de menu façon console : texte clair, icône, fond discret au survol et pour la page active
const navItem =
  "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-text transition-colors hover:bg-surface-2";

/** Compte en haut de la barre latérale, avec le menu de déconnexion. */
function AccountSwitcher({ user }: { user: Props["user"] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-surface-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Menu du compte"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo Google, affichée telle quelle
          <img src={user.image} alt="" width={32} height={32} referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-semibold text-accent-text">
            {initials || "?"}
          </span>
        )}
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold">{user.name}</span>
          <span className="block text-[12px] text-muted">{user.premium ? "Premium" : "Gratuit"}</span>
        </span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      {open && (
        <div className="card absolute inset-x-0 z-30 mt-1 overflow-hidden shadow-xl shadow-black/40">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link
            href="/compte"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-surface-2"
          >
            <UserRound className="size-4" /> Mon compte
          </Link>
          <button
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-[13px] text-danger hover:bg-danger-soft"
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
          >
            <LogOut className="size-4" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

/** Recherche de collectes ; la touche « / » y place le curseur. */
function SidebarSearch() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/tableau-de-bord" className="relative min-w-0 flex-1" role="search">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        name="q"
        type="search"
        placeholder="Rechercher…"
        aria-label="Rechercher une collecte"
        className="h-8 w-full rounded-md border border-border-strong bg-transparent pr-8 pl-8 text-[13px] outline-none placeholder:text-muted focus:border-accent"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border-strong px-1 font-mono text-[10px] text-muted">
        /
      </kbd>
    </form>
  );
}

function Sidebar({ user, quota, onNavigate }: Omit<Props, "children"> & { onNavigate: () => void }) {
  const pathname = usePathname();
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const left = Math.max(0, quota.limit - quota.used);
  const onCollectes = pathname === "/tableau-de-bord" || (pathname.startsWith("/collectes/") && pathname !== "/collectes/nouvelle" && pathname !== "/collectes/enrichir");
  const active = "bg-surface-2";

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-border p-2.5">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <AccountSwitcher user={user} />
          </div>
          <button className="grid size-8 place-items-center rounded-md text-muted hover:text-text lg:hidden" onClick={onNavigate} aria-label="Fermer le menu">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <SidebarSearch />
          <NotificationBell />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5" aria-label="Navigation principale">
        <Link href="/tableau-de-bord" onClick={onNavigate} className={`${navItem} ${onCollectes ? active : ""}`}>
          <House className="size-4" /> Mes collectes
        </Link>
        <Link
          href="/collectes/nouvelle"
          onClick={onNavigate}
          className={`${navItem} ${pathname === "/collectes/nouvelle" ? active : ""}`}
        >
          <Plus className="size-4" /> Nouvelle collecte
        </Link>
        <Link
          href="/collectes/enrichir"
          onClick={onNavigate}
          className={`${navItem} ${pathname === "/collectes/enrichir" ? active : ""}`}
        >
          <FileSpreadsheet className="size-4" /> Compléter un fichier
        </Link>

        <button
          className="mt-3 flex w-full items-center justify-between rounded-md px-2.5 py-[7px] text-[13px] text-muted hover:text-text"
          onClick={() => setTemplatesOpen((o) => !o)}
          aria-expanded={templatesOpen}
        >
          Modèles
          {templatesOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {templatesOpen &&
          TEMPLATES.map((t) => {
            const Icon = ICONS[t.icon];
            return (
              <Link key={t.id} href={`/collectes/nouvelle?modele=${t.id}`} onClick={onNavigate} className={`${navItem} pl-3.5`}>
                <Icon className="size-4" /> {t.label}
              </Link>
            );
          })}
      </nav>

      <div className="p-2.5">
        {user.admin && (
          <Link href="/admin" onClick={onNavigate} className={`${navItem} ${pathname === "/admin" ? active : ""}`}>
            <ShieldCheck className="size-4" /> Administration
          </Link>
        )}
        <Link href="/premium" onClick={onNavigate} className={`${navItem} ${pathname === "/premium" ? active : ""}`}>
          <LifeBuoy className="size-4" /> Aide et formules
        </Link>
      </div>

      <div className="space-y-2.5 border-t border-border p-2.5">
        <dl className="space-y-1 px-1.5 text-[12px]">
          <div className="flex justify-between">
            <dt className="text-muted">Formule</dt>
            <dd className="font-semibold">{quota.premium ? "Premium" : "Gratuite"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Collectes du jour</dt>
            <dd className="tabular-nums">
              <b className="font-semibold">{quota.used}</b> / {quota.limit}
            </dd>
          </div>
        </dl>
        <div className="mx-1.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-label={`${left} collecte(s) restante(s)`}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
        </div>
        {!quota.premium && (
          <Link
            href="/premium"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-accent-text hover:bg-accent-hover"
          >
            Passer à <span className="rounded bg-black/25 px-1.5 text-[12px]">Premium</span>
            <ArrowRight className="ml-auto size-4" />
          </Link>
        )}
        <div className="flex items-center justify-between px-1.5 pt-1 text-muted">
          <span className="inline-flex items-center gap-1.5 text-[12px]">
            <LogoMark className="h-3" /> Luka
          </span>
          <Link href="/premium" onClick={onNavigate} className="text-[12px] hover:text-text">
            Aide
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AppFrame({ user, quota, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Ferme le tiroir mobile à chaque changement de page
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec la navigation
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="console flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 border-r border-border bg-bg lg:block">
        <Sidebar user={user} quota={quota} onNavigate={() => {}} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-bg">
            <Sidebar user={user} quota={quota} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg px-4 lg:hidden">
          <button className="icon-box" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
            <Menu className="size-4" />
          </button>
          <Logo href="/tableau-de-bord" size="sm" />
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
