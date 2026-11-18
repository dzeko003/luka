/* eslint-disable @next/next/no-img-element -- photo statique */
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";

/**
 * Mise en page des écrans de connexion et d'inscription :
 * formulaire à gauche, grande photo avec un message produit à droite (masquée sur mobile).
 */
export function AuthShell({
  children,
  photo,
  photoAlt,
  photoPosition = "center",
  title,
  points,
}: {
  children: ReactNode;
  photo: string;
  photoAlt: string;
  photoPosition?: string;
  title: string;
  points: string[];
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-(--grey) hover:text-(--ink)">
            <ArrowLeft className="size-4" /> Accueil
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        <p className="text-center text-[12px] text-(--grey)">
          <Link href="/conditions-utilisation" className="hover:text-(--ink)">
            Conditions d&apos;utilisation
          </Link>
          <span className="mx-2">·</span>
          <Link href="/confidentialite" className="hover:text-(--ink)">
            Confidentialité
          </Link>
        </p>
      </div>

      <div className="hidden p-3 lg:block">
        <div className="relative h-full min-h-[640px] overflow-hidden rounded-[28px] bg-(--ink)">
          <img src={photo} alt={photoAlt} className="absolute inset-0 size-full object-cover" style={{ objectPosition: photoPosition }} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,27,52,.05)_30%,rgba(20,27,52,.85))]" />
          <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/15 bg-white/10 p-7 text-white backdrop-blur-xl xl:inset-x-10 xl:bottom-10">
            <p className="text-[26px] leading-[1.15] font-semibold tracking-[-0.03em] xl:text-[30px]">{title}</p>
            <ul className="mt-5 space-y-2.5">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-[15px] text-white/85">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/20">
                    <Check className="size-3" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
