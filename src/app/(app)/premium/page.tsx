import { Check, Rocket } from "lucide-react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { limits } from "@/lib/config";

export const metadata: Metadata = { title: "Formules" };

const plans = (premium: boolean) => [
  {
    name: "Gratuite",
    price: "0 FCFA",
    current: !premium,
    features: [
      `${limits.free.collectesPerDay} collectes par jour`,
      `${limits.free.maxRows} lignes maximum par collecte`,
      "OpenStreetMap, recherche web et sites des établissements",
      "Publications scientifiques et leurs auteurs (OpenAlex)",
      "Export CSV et JSON",
    ],
  },
  {
    name: "Premium",
    price: premium ? "Activée" : "Bientôt",
    current: premium,
    features: [
      "Google Maps : téléphones, notes et nombre d'avis",
      "Pages Facebook et comptes Instagram publics des établissements",
      `${limits.premium.maxRows.toLocaleString("fr-FR")} lignes maximum par collecte`,
      `${limits.premium.collectesPerDay} collectes par jour`,
      "Paiement par Mobile Money (MTN, Airtel)",
      "Export Excel et carte des lieux",
    ],
  },
];

export default async function Page() {
  const user = await requireUser();
  const premium = user.plan === "premium";
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Formules</h1>
        <p className="text-[13px] text-muted">
          {premium ? "Ta formule Premium est active." : "La formule Premium arrive bientôt. Ta formule gratuite reste disponible."}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {plans(premium).map((p) => (
          <div key={p.name} className={`card p-6 ${p.current ? "" : "border-accent/40"}`}>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold">{p.name}</p>
              {p.current ? (
                <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">Ta formule</span>
              ) : (
                <span className="icon-box border-accent/30 bg-accent-soft text-accent">
                  <Rocket className="size-4" />
                </span>
              )}
            </div>
            <p className="mt-2 text-[28px] font-semibold">{p.price}</p>
            <ul className="mt-4 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-[13px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
