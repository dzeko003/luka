import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

/** Mise en page commune des pages légales (conditions d'utilisation, confidentialité). */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: { id: string; title: string; body: ReactNode }[];
}) {
  return (
    <div className="border-b border-(--line)">
      <div className="mx-auto max-w-[1330px] border-x border-(--line) px-5 py-14 sm:px-10 sm:py-20 lg:px-14">
        <div className="grid gap-12 lg:grid-cols-[240px_minmax(0,720px)] lg:gap-20">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-[12px] font-semibold tracking-wide text-(--grey) uppercase">Sommaire</p>
            <ol className="mt-4 space-y-2.5 text-[14px] text-(--grey)">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-(--ink)">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-8 border-t border-(--line) pt-6 text-[14px]">
              <Link href="/conditions-utilisation" className="block py-1 text-(--grey) hover:text-(--ink)">
                Conditions d&apos;utilisation
              </Link>
              <Link href="/confidentialite" className="block py-1 text-(--grey) hover:text-(--ink)">
                Politique de confidentialité
              </Link>
            </div>
          </aside>

          <article>
            <p className="text-[14px] text-(--grey)">Dernière mise à jour : {updated}</p>
            <h1 className="mt-3 text-[36px] leading-[1.05] font-semibold tracking-[-0.04em] sm:text-[48px]">{title}</h1>
            <div className="mt-6 text-[17px] leading-relaxed text-(--grey)">{intro}</div>
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-28 border-t border-(--line) pt-8 mt-10">
                <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
                  {i + 1}. {s.title}
                </h2>
                <div className="mt-4 space-y-4 text-[16px] leading-relaxed text-[#4a4f5f] [&_a]:font-medium [&_a]:text-(--violet) [&_a]:underline [&_a]:underline-offset-2 [&_li]:pl-1 [&_strong]:text-(--ink) [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {s.body}
                </div>
              </section>
            ))}
          </article>
        </div>
      </div>
    </div>
  );
}

/** Adresse de contact, configurable par la variable CONTACT_EMAIL (lue à chaque requête, pas au build). */
export async function Contact() {
  await connection();
  const email = process.env.CONTACT_EMAIL;
  return email ? (
    <a href={`mailto:${email}`}>{email}</a>
  ) : (
    <strong>[adresse de contact à renseigner]</strong>
  );
}
