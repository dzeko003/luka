"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Notif = { id: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string };

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const json = await res.json();
    setItems(json.items);
    setUnread(json.unread);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement initial
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative grid size-8 shrink-0 place-items-center rounded-md border border-border-strong text-muted hover:bg-surface-2 hover:text-text"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card fixed top-24 left-3 z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden shadow-xl shadow-black/40 lg:top-12 lg:left-[240px]">
          <p className="border-b border-border px-4 py-2 text-sm font-semibold">Notifications</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">Aucune notification</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="border-b border-border last:border-0">
                  <Link
                    href={n.href ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 text-sm hover:bg-surface-2 ${n.read ? "" : "bg-accent-soft/50"}`}
                  >
                    <span className="block font-medium">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-muted">{n.body}</span>}
                    <span className="mt-1 block text-xs text-muted">
                      {new Date(n.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
