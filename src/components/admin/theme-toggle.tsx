"use client";

import { Moon, Sun } from "lucide-react";
import { useRef } from "react";
import { THEME_KEY } from "./theme";

function currentTheme(el: HTMLElement): "light" | "dark" {
  const t = el.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Bascule entre le mode clair et le mode sombre de l'administration (choix gardé dans ce navigateur). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  function toggle() {
    const root = ref.current?.closest<HTMLElement>(".admin");
    if (!root) return;
    const next = currentTheme(root) === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour cette page */
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-label="Basculer entre le mode clair et le mode sombre"
      title="Mode clair / sombre"
      className={`grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text ${className}`}
    >
      <Sun className="hidden size-4 [.admin[data-theme=dark]_&]:block" />
      <Moon className="size-4 [.admin[data-theme=dark]_&]:hidden" />
    </button>
  );
}
