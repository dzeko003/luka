import Link from "next/link";
import { Logo, Wordmark } from "@/components/logo";

/** En-tête d'origine, inspiré de la maquette : logo, liens à gauche, connexion et inscription à droite. */
function Header() {
  return (
    <div className="sticky top-0 z-50 border-b border-(--line) bg-[#fcfcfc]/85 backdrop-blur-md">
      <header className="mx-auto flex h-[72px] max-w-[1330px] items-center justify-between border-x border-(--line) px-5 sm:h-[84px] sm:px-6">
        <div className="flex items-center gap-10">
          <Logo />
          <nav className="hidden items-center gap-8 text-[15px] text-[#242424] lg:flex">
            <Link href="/#demo" className="hover:text-(--violet)">Démo</Link>
            <Link href="/#pour-qui" className="hover:text-(--violet)">Pour qui</Link>
            <Link href="/#fonctionnement" className="hover:text-(--violet)">Comment ça marche</Link>
            <Link href="/#formules" className="hover:text-(--violet)">Tarifs</Link>
            <Link href="/#faq" className="hover:text-(--violet)">Questions</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-[15px] font-medium sm:gap-6">
          <Link href="/connexion" className="px-2 hover:text-(--violet)">Connexion</Link>
          <Link
            href="/inscription"
            className="inline-flex h-11 items-center rounded-xl border border-[#ebebeb] bg-white px-4 hover:bg-[#f6f6f8] sm:h-[52px] sm:px-5"
          >
            S&apos;inscrire
          </Link>
        </div>
      </header>
    </div>
  );
}

function Footer() {
  const cols = [
    { t: "Produit", l: [["Démo", "/#demo"], ["Comment ça marche", "/#fonctionnement"], ["Tarifs", "/#formules"], ["Questions", "/#faq"]] },
    { t: "Compte", l: [["Connexion", "/connexion"], ["Créer un compte", "/inscription"]] },
    { t: "Légal", l: [["Conditions d'utilisation", "/conditions-utilisation"], ["Confidentialité", "/confidentialite"]] },
  ];
  return (
    <footer className="border-b border-(--line) bg-[#fcfcfc]">
      <div className="mx-auto flex max-w-[1330px] flex-col gap-10 border-x border-(--line) px-5 py-12 sm:px-10 lg:flex-row lg:justify-between lg:px-14">
        <div className="max-w-[360px]">
          <Wordmark />
          <p className="mt-3 text-[15px] leading-relaxed text-(--grey)">
            <i>Luka</i> veut dire « chercher » en lingala. Une plateforme de collecte de données conçue à Brazzaville.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          {cols.map((c) => (
            <div key={c.t}>
              <p className="text-[13px] font-semibold tracking-wide uppercase">{c.t}</p>
              <ul className="mt-4 space-y-3 text-[15px] text-(--grey)">
                {c.l.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="hover:text-(--ink)">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[1330px] border-x border-t border-(--line) px-5 py-5 text-[13px] text-(--grey) sm:px-10 lg:px-14">
        © Luka · Brazzaville, Congo
      </div>
    </footer>
  );
}

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
