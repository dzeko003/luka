import { Suspense } from "react";
import type { CSSProperties } from "react";

// Couleurs communes aux pages publiques (vitrine, pages légales, connexion) ; la police Manrope est chargée dans le layout racine

const theme = {
  "--ink": "#141b34",
  "--purple": "#2e185c",
  "--violet": "#5e0aff",
  "--grey": "#898d99",
  "--grey-2": "#9598a4",
  "--line": "#e7e7e7",
  fontFamily: "var(--font-manrope), system-ui, sans-serif",
} as CSSProperties;

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`min-h-screen bg-[#fcfcfc] text-(--ink) antialiased`} style={theme}>
      <Suspense>{children}</Suspense>
    </div>
  );
}
