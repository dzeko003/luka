import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage } from "@/components/legal-page";
import { limits } from "@/lib/config";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Page() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      updated="20 novembre 2026"
      intro={
        <p>
          Ces conditions encadrent l&apos;utilisation de Luka, un service en ligne qui aide à collecter des données publiques sur le
          web et à les organiser en tableau. En créant un compte, tu acceptes ces conditions.
        </p>
      }
      sections={[
        {
          id: "service",
          title: "Le service",
          body: (
            <>
              <p>
                Luka transforme une demande écrite en français en un tableau de données. Pour cela, le service propose des colonnes,
                lance des recherches sur le web, lit les pages trouvées et en extrait les informations demandées. Chaque ligne indique
                la page d&apos;où elle provient.
              </p>
              <p>
                Le service évolue : des fonctionnalités peuvent être ajoutées, modifiées ou retirées. Nous faisons notre possible pour
                qu&apos;il reste disponible, mais nous ne garantissons pas un fonctionnement sans interruption.
              </p>
            </>
          ),
        },
        {
          id: "compte",
          title: "Ton compte",
          body: (
            <ul>
              <li>Tu crées ton compte avec un email et un mot de passe, ou avec un compte Google.</li>
              <li>Tu dois fournir des informations exactes et garder ton mot de passe confidentiel.</li>
              <li>Tu es responsable de l&apos;activité réalisée depuis ton compte.</li>
              <li>Un compte est personnel. Préviens-nous si tu penses qu&apos;il a été utilisé sans ton accord.</li>
            </ul>
          ),
        },
        {
          id: "formules",
          title: "Formules et limites",
          body: (
            <>
              <p>
                La formule <strong>Gratuite</strong> est sans frais. Elle comprend aujourd&apos;hui {limits.free.collectesPerDay} collectes
                par jour et jusqu&apos;à {limits.free.maxRows} lignes par collecte. Ces limites peuvent évoluer ; elles sont toujours
                indiquées dans ton compte.
              </p>
              <p>
                La formule <strong>Premium</strong> sera proposée prochainement, avec un paiement par Mobile Money. Son prix et ses
                conditions de paiement seront affichés avant toute souscription. Tu pourras passer de la formule Gratuite à Premium
                depuis ton compte, en conservant tes collectes.
              </p>
            </>
          ),
        },
        {
          id: "usage",
          title: "Utilisation acceptable",
          body: (
            <>
              <p>Tu t&apos;engages à ne pas utiliser Luka pour :</p>
              <ul>
                <li>collecter des données personnelles sensibles ou constituer des fichiers sur des personnes sans base légale ;</li>
                <li>harceler, surveiller ou porter atteinte aux droits d&apos;autrui ;</li>
                <li>contourner les limites du service, l&apos;automatiser de façon abusive ou perturber son fonctionnement ;</li>
                <li>toute activité contraire à la loi.</li>
              </ul>
              <p>Nous pouvons suspendre ou bloquer un compte qui ne respecte pas ces règles.</p>
            </>
          ),
        },
        {
          id: "donnees",
          title: "Fiabilité des résultats",
          body: (
            <>
              <p>
                Les résultats sont produits automatiquement, à partir de pages publiques et d&apos;un modèle d&apos;intelligence
                artificielle. Ils peuvent être incomplets, dépassés ou inexacts. C&apos;est pourquoi chaque ligne indique sa source et
                un niveau de confiance, et peut être vérifiée, corrigée ou rejetée.
              </p>
              <p>
                <strong>Tu restes responsable de la vérification</strong> des données avant de les utiliser, notamment dans un travail
                académique, une publication ou une décision.
              </p>
            </>
          ),
        },
        {
          id: "propriete",
          title: "Contenus et propriété",
          body: (
            <>
              <p>
                Tes demandes et les tableaux que tu exportes t&apos;appartiennent. Les informations collectées proviennent de sites
                tiers : leur réutilisation reste soumise aux droits et conditions de ces sites. Cite tes sources lorsque c&apos;est
                nécessaire.
              </p>
              <p>Le nom Luka, l&apos;interface et le code du service restent notre propriété.</p>
            </>
          ),
        },
        {
          id: "base",
          title: "Base Luka et contributions",
          body: (
            <>
              <p>
                Sauf si tu le désactives (Mon compte, ou sur chaque collecte), les informations publiques d&apos;établissements contenues
                dans les lignes que tu valides rejoignent la base commune de Luka et peuvent être proposées aux autres utilisateurs. Un
                fichier importé pour être complété n&apos;est partagé que si tu le demandes explicitement.
              </p>
              <p>
                En envoyant une contribution, tu garantis que les données sont publiques ou que tu as le droit de les partager, qu&apos;elles
                ne concernent pas des personnes privées, et tu autorises Luka à les vérifier, les corriger, les combiner avec d&apos;autres
                sources et les mettre à disposition de ses utilisateurs, sans contrepartie. Luka peut refuser ou retirer une contribution
                à tout moment.
              </p>
            </>
          ),
        },
        {
          id: "responsabilite",
          title: "Responsabilité",
          body: (
            <p>
              Luka est fourni « en l&apos;état ». Dans la limite permise par la loi, nous ne sommes pas responsables des dommages
              indirects liés à l&apos;utilisation du service ou des données collectées, ni du contenu des sites tiers vers lesquels
              renvoient les sources.
            </p>
          ),
        },
        {
          id: "fin",
          title: "Fin d'utilisation",
          body: (
            <p>
              Tu peux arrêter d&apos;utiliser Luka à tout moment et demander la suppression de ton compte en nous écrivant à{" "}
              <Contact />. Le traitement de tes données est décrit dans la{" "}
              <Link href="/confidentialite">politique de confidentialité</Link>.
            </p>
          ),
        },
        {
          id: "modifications",
          title: "Modifications et droit applicable",
          body: (
            <>
              <p>
                Nous pouvons mettre à jour ces conditions. En cas de changement important, nous t&apos;en informerons dans
                l&apos;application. La date de dernière mise à jour figure en haut de cette page.
              </p>
              <p>Ces conditions sont régies par le droit de la République du Congo.</p>
              <p>
                Une question ? Écris-nous à <Contact />.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
