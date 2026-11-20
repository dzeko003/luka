import { VisitBeacon } from "@/components/visit-beacon";
/* eslint-disable @next/next/no-img-element -- photos et visuels statiques */
import {
  ArrowRight,
  ChevronRight,
  FileJson,
  FileSpreadsheet,
  Rocket,
  Table2,
  BadgeCheck,
  BookOpen,
  Check,
  Columns3,
  Download,
  Globe,
  GraduationCap,
  HandCoins,
  Link2,
  MessageSquareText,
  Microscope,
  Play,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { limits } from "@/lib/config";

const IMG = "/landing";

/* ───────────── éléments communs ───────────── */

/** Bande pleine largeur : le contenu reste dans le cadre aux lignes verticales. */
function Band({ id, children, className = "", inner = "" }: { id?: string; children: ReactNode; className?: string; inner?: string }) {
  return (
    <section id={id} className={`scroll-mt-[84px] border-b border-(--line) ${className}`}>
      <div className={`mx-auto max-w-[1330px] border-x border-(--line) ${inner}`}>{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-white px-3 py-1 text-[13px] font-medium text-(--violet)">
      {children}
    </p>
  );
}

function SectionTitle({ eyebrow, title, intro }: { eyebrow: string; title: ReactNode; intro?: ReactNode }) {
  return (
    <div className="max-w-[720px]">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-[32px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[44px]">{title}</h2>
      {intro && <p className="mt-4 text-[17px] leading-relaxed text-(--grey) sm:text-[18px]">{intro}</p>}
    </div>
  );
}

const btn =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold whitespace-nowrap transition";
const btnPrimary = `${btn} bg-(--violet) text-white shadow-[0_8px_24px_-8px_rgba(94,10,255,.6)] hover:bg-[#5000e6]`;
const btnGhost = `${btn} border border-(--line) bg-white hover:border-(--ink)`;

/* ───────────── 1. Hero ───────────── */

const EXEMPLE = [
  { nom: "Makélékélé", n: "1", src: "fr.wikipedia.org", conf: 92 },
  { nom: "Bacongo", n: "2", src: "fr.wikipedia.org", conf: 88 },
  { nom: "Poto-Poto", n: "3", src: "site de la mairie", conf: 81 },
  { nom: "Moungali", n: "4", src: "article de presse", conf: 46 },
];

const EXPORTS = [
  { icon: FileSpreadsheet, label: "CSV", color: "text-[#12a07e]", rot: "-rotate-[8deg] translate-y-1" },
  { icon: Table2, label: "Excel", color: "text-[#1d6f42]", rot: "z-10 -translate-y-1" },
  { icon: FileJson, label: "JSON", color: "text-[#d9774f]", rot: "rotate-[8deg] translate-y-1" },
];

function Hero() {
  return (
    <Band className="bg-[#f4f4f5]" inner="grid gap-10 px-5 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1fr_1.02fr] lg:gap-12 lg:px-14 lg:py-20">
      {/* Texte */}
      <div className="flex flex-col">
        <p className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[13px] text-[#5b5f6b] shadow-[0_1px_2px_rgba(0,0,0,.06)]">
          <Rocket className="size-3.5 text-(--ink)" /> Ta collecte de données, sans copier-coller
        </p>
        <h1 className="mt-6 text-[44px] leading-[1.03] font-normal tracking-[-0.045em] sm:text-[64px]">
          Tu décris les données, Luka remplit le tableau
        </h1>
        <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-[#6b6f7b] sm:text-[18px]">
          Écris en français ce que tu cherches. Luka fouille le web, lit les pages et te rend un tableau prêt à l&apos;emploi, avec la
          source de chaque ligne.
        </p>

        <div className="mt-10 flex flex-wrap items-stretch gap-3 lg:mt-auto lg:pt-16">
          <Link
            href="/inscription"
            className="inline-flex h-[64px] items-center gap-2 rounded-2xl bg-white px-7 text-[18px] font-medium shadow-[0_10px_30px_-10px_rgba(20,27,52,.25),0_1px_2px_rgba(0,0,0,.05)] transition hover:-translate-y-0.5"
          >
            Essayer gratuitement <ArrowRight className="size-4.5" />
          </Link>
          <div className="inline-flex h-[64px] items-center gap-3 rounded-2xl bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,.05)]">
            <div className="flex -space-x-2.5">
              {[1, 2, 3].map((i) => (
                <img key={i} src={`${IMG}/avatar-${i}.webp`} alt="" className="size-9 rounded-full object-cover ring-2 ring-white" />
              ))}
            </div>
            <span className="text-[30px] leading-none font-normal tracking-[-0.03em]">0 FCFA</span>
            <span className="max-w-[72px] text-[12px] leading-tight text-[#6b6f7b]">pour commencer</span>
          </div>
        </div>
      </div>

      {/* Aperçu produit en cartes */}
      <div className="grid grid-cols-2 gap-1.5 rounded-[24px] border border-white bg-white/50 p-1.5 shadow-[0_30px_60px_-30px_rgba(20,27,52,.2)]">
        <div className="col-span-2 rounded-[18px] bg-[#f7f7f8] px-4 pt-5 pb-4 sm:px-6">
          <p className="text-center text-[15px] font-medium">Arrondissements de Brazzaville</p>
          <p className="mt-1 text-center text-[12px] text-[#8a8d99]">Collecte terminée · chaque ligne avec sa source</p>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              <span className="rounded-md bg-[#e8efff] px-2 py-0.5 text-[11px] text-[#3b63d6]">Source : fr.wikipedia.org</span>
              <span className="rounded-md bg-[#fff1e6] px-2 py-0.5 text-[11px] text-[#d9774f]">Confiance : 88 %</span>
          </div>
          <div className="mt-3">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] tracking-wide text-[#a3a6b1] uppercase">
                <tr>
                  <th className="pb-2 font-medium">Arrondissement</th>
                  <th className="pb-2 font-medium">N°</th>
                  <th className="hidden pb-2 font-medium sm:table-cell">Source</th>
                  <th className="pb-2 font-medium">Confiance</th>
                </tr>
              </thead>
              <tbody>
                {EXEMPLE.map((r, i) => (
                  <tr key={r.nom} className={`border-t border-dashed border-[#e3e3e8] ${i === 1 ? "bg-white" : ""}`}>
                    <td className="py-2.5 pl-1 font-medium">{r.nom}</td>
                    <td className="py-2.5 text-[#6b6f7b] tabular-nums">{r.n}</td>
                    <td className="hidden py-2.5 sm:table-cell">
                      <span className="inline-flex items-center gap-1 text-[#4b5bd6]">
                        <Link2 className="size-3" /> {r.src}
                      </span>
                    </td>
                    <td className="py-2.5 pr-1">
                      <span className="block h-1.5 w-20 overflow-hidden rounded-full bg-[#e6e6ea]">
                        <span
                          className={`block h-full rounded-full ${r.conf > 60 ? "bg-[#6c8cf5]" : "bg-[#f0a36b]"}`}
                          style={{ width: `${r.conf}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-[11px] text-[#a3a6b1]">Aperçu illustratif</p>
        </div>

        <div className="flex flex-col rounded-[18px] bg-[#f7f7f8] p-4 sm:p-5">
          <p className="text-[14px] font-medium">Exporte en un clic</p>
          <p className="mt-1 text-[12px] leading-snug text-[#8a8d99]">Un CSV qui s&apos;ouvre dans Excel en français, ou du JSON pour tes outils.</p>
          <div className="mt-auto flex justify-center pt-5">
            {EXPORTS.map((e) => (
              <span
                key={e.label}
                className={`-mx-1 grid size-[60px] place-items-center rounded-xl bg-white shadow-[0_6px_16px_-6px_rgba(20,27,52,.25)] sm:size-[68px] ${e.rot}`}
              >
                <span className="flex flex-col items-center gap-0.5">
                  <e.icon className={`size-6 ${e.color}`} />
                  <span className="text-[10px] font-semibold text-[#6b6f7b]">{e.label}</span>
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-[18px] bg-[#f7f7f8] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="text-[44px] leading-none font-normal tracking-[-0.05em] sm:text-[52px]">{limits.free.maxRows}</span>
            <span className="flex -space-x-2 text-[#c9cbd3]">
              <ChevronRight className="size-7 opacity-100" strokeWidth={1.5} />
              <ChevronRight className="size-7 opacity-70" strokeWidth={1.5} />
              <ChevronRight className="size-7 opacity-40" strokeWidth={1.5} />
            </span>
          </div>
          <p className="mt-auto pt-6 text-[12px] leading-snug text-[#8a8d99]">
            lignes sourcées par collecte avec l&apos;offre gratuite, et davantage avec Premium.
          </p>
        </div>
      </div>
    </Band>
  );
}

/* ───────────── 2. Ce que fait Luka, en une phrase ───────────── */

const FAITS = [
  { icon: MessageSquareText, t: "Une demande en français", d: "Pas de formulaire compliqué : tu écris ce que tu cherches, comme à un collègue." },
  { icon: Columns3, t: "Des colonnes proposées", d: "Luka suggère les colonnes du tableau. Tu les gardes, les renommes ou en ajoutes." },
  { icon: Link2, t: "Une source par ligne", d: "Chaque ligne indique la page d'où elle vient. Tu peux toujours vérifier." },
  { icon: Download, t: "Un fichier prêt", d: "Export CSV qui s'ouvre dans Excel en français, ou JSON pour tes outils." },
];

function Faits() {
  return (
    <Band className="bg-[#fcfcfc]" inner="grid sm:grid-cols-2 lg:grid-cols-4">
      {FAITS.map((f, i) => (
        <div
          key={f.t}
          className={`px-5 py-8 sm:px-8 ${i > 0 ? "border-t border-(--line) sm:border-t-0" : ""} ${i % 2 ? "sm:border-l sm:border-(--line)" : ""} ${i >= 2 ? "sm:border-t sm:border-(--line) lg:border-t-0" : ""} ${i === 2 ? "lg:border-l lg:border-(--line)" : ""}`}
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[#f0eaff] text-(--violet)">
            <f.icon className="size-5" />
          </span>
          <p className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">{f.t}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-(--grey)">{f.d}</p>
        </div>
      ))}
    </Band>
  );
}

/* ───────────── 3. Démo vidéo ───────────── */

function Demo() {
  // Vidéo de démonstration (carrée, avec voix off) ; DEMO_VIDEO_URL permet d'en servir une autre.
  const video = process.env.DEMO_VIDEO_URL || `${IMG}/luka-demo.mp4`;
  return (
    <Band id="demo" className="bg-white" inner="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <div className="mx-auto max-w-[760px] text-center">
        <Eyebrow>
          <Play className="size-3.5" /> Démo
        </Eyebrow>
        <h2 className="mt-4 text-[32px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[44px]">
          Regarde Luka remplir un tableau, du début à la fin.
        </h2>
      </div>

      {/* Cadre « navigateur » qui accueille la vidéo de démonstration */}
      <div className="mx-auto mt-12 max-w-[720px] overflow-hidden rounded-2xl border border-(--line) bg-white p-2 shadow-[0_40px_80px_-40px_rgba(20,27,52,.35)] sm:rounded-3xl sm:p-3">
        <div className="flex items-center gap-2 px-2 pb-2 sm:pb-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 hidden h-6 flex-1 items-center rounded-md bg-[#f3f3f6] px-3 text-[12px] text-(--grey) sm:flex">
            luka · nouvelle collecte
          </span>
        </div>
        <div className="relative aspect-square overflow-hidden rounded-xl bg-(--ink) sm:rounded-2xl">
          <video
            src={video}
            poster={`${IMG}/luka-demo-poster.webp`}
            className="size-full object-cover"
            playsInline
            controls
            preload="metadata"
          >
            Ton navigateur ne peut pas lire cette vidéo.
          </video>
        </div>
      </div>

      <ol className="mx-auto mt-8 flex max-w-[1080px] flex-wrap justify-center gap-x-8 gap-y-3 text-[14px] text-(--grey)">
        {["Tu décris ce que tu cherches", "Luka cherche et lit les pages", "Tu vérifies et tu exportes"].map((t, i) => (
          <li key={t} className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-[#f0eaff] text-[12px] font-semibold text-(--violet)">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>
    </Band>
  );
}

/* ───────────── 4. Pour qui ───────────── */

const PUBLICS = [
  {
    img: "etudiante-laptop.webp",
    alt: "Une étudiante travaille sur son ordinateur portable",
    icon: GraduationCap,
    t: "Étudiants",
    d: "Mémoire, exposé, projet de fin d'études : constitue ta base de données sans y passer tes soirées.",
    ex: "« Les universités publiques d'Afrique centrale et leurs facultés »",
  },
  {
    img: "chercheuse-labo.webp",
    pos: "object-[center_15%]",
    alt: "Une chercheuse travaille dans un laboratoire",
    icon: Microscope,
    t: "Chercheurs",
    d: "Prépare ton terrain d'étude : listes d'établissements, d'acteurs ou de structures, avec leurs sources à citer.",
    ex: "« Les centres de santé de Pointe-Noire avec leur adresse »",
  },
  {
    img: "equipe-laptop.webp",
    alt: "Trois femmes échangent autour d'un ordinateur portable",
    icon: Users,
    t: "ONG, associations, entreprises",
    d: "Trouve des partenaires, des fournisseurs ou des contacts institutionnels, et partage le fichier avec ton équipe.",
    ex: "« Les associations de femmes entrepreneures à Brazzaville »",
  },
];

function Publics() {
  return (
    <Band id="pour-qui" className="bg-[#fcfcfc]" inner="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <SectionTitle
        eyebrow="Pour qui ?"
        title="Pour tous ceux qui passent des heures à copier-coller des informations."
        intro="Luka fait le travail de recherche répétitif. Toi, tu gardes le contrôle : tu vérifies, tu corriges, tu exportes."
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PUBLICS.map((p) => (
          <article key={p.t} className="group overflow-hidden rounded-2xl border border-(--line) bg-white">
            <div className="aspect-[4/3] overflow-hidden">
              <img
                src={`${IMG}/${p.img}`}
                alt={p.alt}
                loading="lazy"
                className={`size-full object-cover transition duration-500 group-hover:scale-[1.03] ${"pos" in p ? p.pos : ""}`}
              />
            </div>
            <div className="p-6">
              <p className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.02em]">
                <p.icon className="size-5 text-(--violet)" /> {p.t}
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-(--grey)">{p.d}</p>
              <p className="mt-4 rounded-xl bg-[#f6f3ff] px-4 py-3 text-[14px] leading-snug text-[#3b2a7a]">{p.ex}</p>
            </div>
          </article>
        ))}
      </div>
    </Band>
  );
}

/* ───────────── 5. Comment ça marche ───────────── */

const ETAPES = [
  { icon: MessageSquareText, t: "Décris", d: "Écris ta demande en français. Exemple : « les hôpitaux de Brazzaville avec leur téléphone »." },
  { icon: Columns3, t: "Ajuste les colonnes", d: "Luka propose les colonnes du tableau. Tu modifies ce que tu veux, puis tu lances." },
  { icon: Search, t: "Luka cherche et lit", d: "Il interroge le web, lit les pages trouvées, extrait les données et fusionne les doublons." },
  { icon: BadgeCheck, t: "Vérifie et exporte", d: "Chaque ligne a sa source. Tu valides, tu corriges, puis tu télécharges ton fichier." },
];

function Fonctionnement() {
  return (
    <Band id="fonctionnement" className="bg-white" inner="">
      <div className="px-5 pt-16 sm:px-10 sm:pt-24 lg:px-14">
        <SectionTitle eyebrow="Comment ça marche" title="Quatre étapes, quelques minutes." />
      </div>
      <ol className="mt-12 grid border-t border-(--line) sm:grid-cols-2 lg:grid-cols-4">
        {ETAPES.map((e, i) => (
          <li
            key={e.t}
            className={`relative px-5 py-10 sm:px-8 ${i > 0 ? "border-t border-(--line) sm:border-t-0" : ""} ${i % 2 ? "sm:border-l sm:border-(--line)" : ""} ${i >= 2 ? "sm:border-t sm:border-(--line) lg:border-t-0" : ""} ${i === 2 ? "lg:border-l lg:border-(--line)" : ""}`}
          >
            <span className="text-[56px] leading-none font-semibold tracking-[-0.05em] text-[#ece8fb]">0{i + 1}</span>
            <span className="mt-4 grid size-11 place-items-center rounded-xl bg-(--ink) text-white">
              <e.icon className="size-5" />
            </span>
            <p className="mt-5 text-[19px] font-semibold tracking-[-0.02em]">{e.t}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-(--grey)">{e.d}</p>
          </li>
        ))}
      </ol>
    </Band>
  );
}

/* ───────────── 6. Pourquoi Luka ───────────── */

const SANS = [
  "Des dizaines d'onglets ouverts, des heures de copier-coller",
  "Des informations dont on ne sait plus d'où elles viennent",
  "Des doublons et des cases vides à nettoyer à la main",
  "Un fichier mal formaté quand on l'ouvre dans Excel",
];
const AVEC = [
  "Une seule demande, Luka cherche et lit les pages pour toi",
  "La source de chaque ligne, pour citer et vérifier",
  "Les doublons fusionnés, les cases complétées d'une page à l'autre",
  "Un CSV qui s'ouvre proprement dans Excel en français",
];

function Pourquoi() {
  return (
    <Band id="pourquoi" className="bg-[#fcfcfc]" inner="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <SectionTitle
        eyebrow="Pourquoi Luka"
        title="Des données fiables, sans y passer la semaine."
        intro="Une donnée sans source ne vaut pas grand-chose dans un mémoire, un rapport ou une étude. Luka te fait gagner du temps sans sacrifier la traçabilité."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-(--line) bg-white p-7">
          <p className="text-[15px] font-semibold text-(--grey)">Sans Luka</p>
          <ul className="mt-5 space-y-4">
            {SANS.map((s) => (
              <li key={s} className="flex gap-3 text-[16px] leading-snug text-(--grey)">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#fdecec] text-[#d14343]">
                  <X className="size-3" />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-(--ink) p-7 text-white">
          <p className="text-[15px] font-semibold text-[#b9a4ff]">Avec Luka</p>
          <ul className="mt-5 space-y-4">
            {AVEC.map((s) => (
              <li key={s} className="flex gap-3 text-[16px] leading-snug">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#12a07e] text-white">
                  <Check className="size-3" />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "Rien d'inventé", d: "Une ligne sans source vérifiable est marquée « à vérifier », avec une confiance plafonnée." },
          { icon: Globe, t: "Pensé en français", d: "Demandes, colonnes et exports en français, pour les contextes africains francophones." },
          { icon: BookOpen, t: "Des sources à citer", d: "Garde le lien vers chaque page consultée, utile pour ta bibliographie." },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border border-(--line) bg-white p-6">
            <c.icon className="size-6 text-(--violet)" />
            <p className="mt-4 text-[17px] font-semibold">{c.t}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-(--grey)">{c.d}</p>
          </div>
        ))}
      </div>
    </Band>
  );
}

/* ───────────── 7. Tarifs ───────────── */

function Tarifs() {
  const gratuit = [
    `${limits.free.collectesPerDay} collectes par jour`,
    `Jusqu'à ${limits.free.maxRows} lignes par collecte`,
    "Recherche web et source pour chaque ligne",
    "Vérification et correction des lignes",
    "Export CSV (Excel) et JSON",
  ];
  const premium = [
    "Recherche approfondie avec un modèle d'IA plus puissant",
    "Plus de collectes et plus de lignes",
    "Export Excel et carte des lieux",
    "Paiement par Mobile Money (MTN, Airtel)",
  ];
  return (
    <Band id="formules" className="bg-white" inner="px-5 py-16 sm:px-10 sm:py-24 lg:px-14">
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <SectionTitle
          eyebrow="Tarifs"
          title="Commence gratuitement. Passe à Premium quand tu en as besoin."
          intro="Pas de carte bancaire pour commencer. Quand tes besoins grandiront, tu pourras passer de la formule Gratuite à Premium depuis ton compte, en gardant toutes tes collectes."
        />
      </div>
      <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col rounded-2xl border border-(--line) bg-[#fcfcfc] p-7 sm:p-9">
          <p className="text-[15px] font-semibold text-(--grey)">Gratuit</p>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-[48px] leading-none font-semibold tracking-[-0.04em]">0</span>
            <span className="text-[18px] font-semibold">FCFA</span>
            <span className="text-[15px] text-(--grey)">/ pour toujours</span>
          </p>
          <p className="mt-3 text-[15px] text-(--grey)">Pour découvrir Luka et les besoins ponctuels.</p>
          <ul className="mt-7 space-y-3">
            {gratuit.map((f) => (
              <li key={f} className="flex gap-2.5 text-[15px]">
                <Check className="mt-0.5 size-4 shrink-0 text-[#12a07e]" /> {f}
              </li>
            ))}
          </ul>
          <Link href="/inscription" className={`${btnGhost} mt-10 w-full`}>
            Créer mon compte gratuit
          </Link>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-(--ink) p-7 text-white sm:p-9">
          <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-(--violet) opacity-40 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <p className="text-[15px] font-semibold text-[#b9a4ff]">Premium</p>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium">Bientôt disponible</span>
          </div>
          <p className="relative mt-3 text-[34px] leading-tight font-semibold tracking-[-0.03em]">Prix annoncé au lancement</p>
          <p className="relative mt-3 text-[15px] text-white/60">Pour les mémoires, les études et les équipes qui collectent souvent.</p>
          <ul className="relative mt-7 space-y-3">
            {premium.map((f) => (
              <li key={f} className="flex gap-2.5 text-[15px]">
                <Check className="mt-0.5 size-4 shrink-0 text-[#b9a4ff]" /> {f}
              </li>
            ))}
          </ul>
          <div className="relative mt-10 flex items-center gap-3 rounded-xl bg-white/5 p-4 text-[14px] text-white/80">
            <Smartphone className="size-5 shrink-0 text-[#b9a4ff]" />
            Commence en Gratuit dès maintenant : à son lancement, tu passeras à Premium depuis la page Formules de ton compte, payable
            par Mobile Money.
          </div>
        </div>
      </div>
    </Band>
  );
}

/* ───────────── 8. Questions fréquentes ───────────── */

const FAQ = [
  {
    q: "D'où viennent les données ?",
    r: "Luka lance des recherches sur le web, lit les pages trouvées (sites officiels, Wikipédia, presse, annuaires…) et extrait les informations demandées. Chaque ligne garde le lien de la page d'origine.",
  },
  {
    q: "Est-ce que Luka peut se tromper ?",
    r: "Oui, comme toute recherche. C'est pour ça que chaque ligne a une source et un niveau de confiance, et que tu peux valider, rejeter ou corriger chaque ligne avant d'exporter.",
  },
  {
    q: "Combien de temps dure une collecte ?",
    r: "En général quelques minutes. La collecte tourne en arrière-plan et Luka t'envoie une notification quand ton tableau est prêt.",
  },
  {
    q: "Dans quels formats puis-je exporter ?",
    r: "En CSV, qui s'ouvre directement dans Excel en français, et en JSON pour tes outils ou tes scripts.",
  },
  {
    q: "Comment passer à Premium ?",
    r: "Premium arrive bientôt. Tu pourras y passer depuis la page Formules de ton compte, avec un paiement par Mobile Money (MTN, Airtel). Tes collectes et tes exports restent disponibles.",
  },
  {
    q: "Faut-il savoir coder ?",
    r: "Non. Tu écris ta demande en français, comme tu la poserais à quelqu'un. Luka s'occupe du reste.",
  },
];

function Questions() {
  return (
    <Band id="faq" className="bg-[#fcfcfc]" inner="grid gap-10 px-5 py-16 sm:px-10 sm:py-24 lg:grid-cols-[380px_1fr] lg:px-14">
      <SectionTitle eyebrow="Questions fréquentes" title="Tu te poses une question ?" />
      <div className="divide-y divide-(--line) border-y border-(--line)">
        {FAQ.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="grid size-7 shrink-0 place-items-center rounded-full border border-(--line) text-(--grey) transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-(--grey)">{f.r}</p>
          </details>
        ))}
      </div>
    </Band>
  );
}

/* ───────────── 9. Appel final + pied de page ───────────── */

function Final() {
  return (
    <Band className="bg-white" inner="p-3 sm:p-5">
      <div className="relative overflow-hidden rounded-2xl bg-(--ink) px-6 py-16 text-center text-white sm:py-24">
        <div className="pointer-events-none absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-(--violet) opacity-35 blur-[120px]" />
        <div className="relative mx-auto max-w-[680px]">
          <HandCoins className="mx-auto size-8 text-[#b9a4ff]" />
          <h2 className="mt-5 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[48px]">
            Ta prochaine base de données commence par une phrase.
          </h2>
          <p className="mt-4 text-[17px] text-white/70">Crée ton compte en une minute. Gratuit, sans carte bancaire.</p>
          <form action="/inscription" className="mx-auto mt-8 flex max-w-[480px] flex-col gap-2 sm:flex-row">
            <label htmlFor="email-final" className="sr-only">
              Adresse email
            </label>
            <input
              id="email-final"
              name="email"
              type="email"
              placeholder="Ton adresse email"
              className="h-12 w-full min-w-0 shrink-0 rounded-xl bg-white px-4 text-[15px] text-(--ink) outline-none placeholder:text-[#8a8d99] sm:w-auto sm:flex-1"
            />
            <button className={btnPrimary}>
              Commencer <ArrowRight className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </Band>
  );
}

export default async function Home() {
  if (await getSession()) redirect("/tableau-de-bord");
  return (
    <>
      <VisitBeacon path="/" />
      <Hero />
      <Faits />
      <Demo />
      <Publics />
      <Fonctionnement />
      <Pourquoi />
      <Tarifs />
      <Questions />
      <Final />
    </>
  );
}
