import Link from "next/link";

/**
 * Logo unique de Luka, utilisé sur toutes les pages.
 * Symbole : un bloc qui dessine la lettre L, avec une découpe courbe et une fine entaille à gauche.
 */
const L_PATH = "M0 0H13C13 12.5 16.5 19 26 19H36V32H0ZM0 8.6C5 8.6 8.6 10.2 10.2 13.8 7.6 11.6 4.6 10.9 0 10.9Z";

export function LogoMark({ className = "h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 32" className={`w-auto shrink-0 ${className}`} aria-hidden>
      <path fill="currentColor" fillRule="evenodd" d={L_PATH} />
    </svg>
  );
}

const sizes = {
  sm: { mark: "h-5", text: "text-[22px]", gap: "gap-2" },
  md: { mark: "h-6", text: "text-[26px]", gap: "gap-2.5" },
  lg: { mark: "h-7", text: "text-[30px]", gap: "gap-3" },
};

export function Wordmark({ size = "md", tone = "auto" }: { size?: keyof typeof sizes; tone?: "auto" | "light" }) {
  const s = sizes[size];
  // « auto » suit la couleur --ink : bleu nuit sur le site, claire dans l'application en mode sombre
  const color = tone === "light" ? "text-white" : "text-(--ink)";
  return (
    <span className={`inline-flex items-center ${s.gap} ${color}`}>
      <LogoMark className={s.mark} />
      <span
        className={`${s.text} leading-none font-medium tracking-[-0.045em]`}
        style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
      >
        luka
      </span>
    </span>
  );
}

export function Logo({ href = "/", size = "md", tone = "auto" }: { href?: string; size?: keyof typeof sizes; tone?: "auto" | "light" }) {
  return (
    <Link href={href} aria-label="Luka, accueil" className="inline-flex">
      <Wordmark size={size} tone={tone} />
    </Link>
  );
}
