import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Manrope } from "next/font/google";
import "./globals.css";

const body = Geist({ variable: "--font-body", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono-face", subsets: ["latin"] });
// Police du logo et des pages publiques
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
// Police de l'espace connecté (tableau de bord)
const inter = Inter({ variable: "--font-console", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Luka — collecte de données", template: "%s · Luka" },
  description: "Décris les données que tu cherches : Luka les trouve sur le web, avec leurs sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${body.variable} ${mono.variable} ${manrope.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-sm">{children}</body>
    </html>
  );
}
