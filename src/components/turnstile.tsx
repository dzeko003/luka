"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback": () => void }) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Message en français pour les refus du captcha renvoyés par le serveur, sinon null. */
export function captchaErrorMessage(code?: string) {
  if (code === "MISSING_RESPONSE") return "Valide le captcha avant de continuer.";
  if (code === "VERIFICATION_FAILED" || code === "UNKNOWN_ERROR") return "La vérification anti-robot a échoué. Réessaie.";
  return null;
}

/**
 * Captcha Cloudflare Turnstile — affiché seulement si la clé publique est configurée.
 * Un jeton ne sert qu'une fois : incrémenter `resetSignal` après chaque envoi pour en obtenir un nouveau.
 */
export function Turnstile({ onToken, resetSignal = 0 }: { onToken: (token: string | null) => void; resetSignal?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = () => {
    if (!ref.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(ref.current, {
      sitekey: turnstileSiteKey,
      callback: (t) => onToken(t),
      "expired-callback": () => onToken(null),
    });
  };

  useEffect(() => {
    render();
    return () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!resetSignal || !widgetId.current) return;
    onToken(null);
    window.turnstile?.reset(widgetId.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  if (!turnstileSiteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onLoad={render} />
      <div ref={ref} className="min-h-[65px]" />
    </>
  );
}
