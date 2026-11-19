"use client";

import { useEffect } from "react";

/** Signale la visite de la page (statistiques de l'administration : nombre de visites et pays). Aucun cookie. */
export function VisitBeacon({ path }: { path: string }) {
  useEffect(() => {
    const body = JSON.stringify({ path, referrer: document.referrer });
    if (!navigator.sendBeacon?.("/api/visite", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/visite", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
    }
  }, [path]);
  return null;
}
