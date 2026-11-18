import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updated="17 novembre 2026"
      intro={
        <p>
          Cette page explique quelles données Luka enregistre, pourquoi, avec qui elles sont partagées et comment exercer tes droits.
          Nous collectons uniquement ce qui est nécessaire au fonctionnement du service.
        </p>
      }
      sections={[
        {
          id: "collecte",
          title: "Données que nous enregistrons",
          body: (
            <ul>
              <li>
                <strong>Compte</strong> : ton nom, ton adresse email et ton mot de passe (stocké sous forme hachée, jamais en clair).
                Si tu te connectes avec Google, nous recevons ton nom, ton email et ta photo de profil.
              </li>
              <li>
                <strong>Sessions</strong> : l&apos;adresse IP et le type de navigateur utilisés lors de la connexion, pour sécuriser
                ton compte.
              </li>
              <li>
                <strong>Collectes</strong> : tes demandes, les colonnes choisies, les tableaux obtenus, leurs sources et tes
                corrections.
              </li>
              <li>
                <strong>Utilisation</strong> : le nombre de collectes et d&apos;appels au modèle d&apos;IA, pour appliquer les limites
                de ta formule.
              </li>
              <li>
                <strong>Notifications</strong> : les messages que Luka t&apos;envoie dans l&apos;application (collecte terminée, etc.).
              </li>
            </ul>
          ),
        },
        {
          id: "finalites",
          title: "Pourquoi nous les utilisons",
          body: (
            <ul>
              <li>créer et sécuriser ton compte ;</li>
              <li>réaliser tes collectes et conserver tes résultats ;</li>
              <li>appliquer les limites de ta formule et prévenir les abus ;</li>
              <li>t&apos;informer de l&apos;avancement de tes collectes.</li>
            </ul>
          ),
        },
        {
          id: "partage",
          title: "Services tiers",
          body: (
            <>
              <p>Pour fonctionner, Luka fait appel à quelques prestataires techniques :</p>
              <ul>
                <li>
                  <strong>Moteur de recherche web</strong> : reçoit les requêtes de recherche générées à partir de ta demande.
                </li>
                <li>
                  <strong>Fournisseur de modèle d&apos;IA</strong> : reçoit ta demande et le texte des pages lues, afin
                  d&apos;en extraire les données.
                </li>
                <li>
                  <strong>Hébergeur et base de données</strong> : stockent les données listées ci-dessus.
                </li>
                <li>
                  <strong>Google</strong>, uniquement si tu choisis de te connecter avec ton compte Google.
                </li>
                <li>
                  <strong>Cloudflare Turnstile</strong>, s&apos;il est activé, pour vérifier que les inscriptions ne viennent pas de
                  robots.
                </li>
              </ul>
              <p>
                Nous ne vendons pas tes données et ne les utilisons pas à des fins publicitaires. Évite d&apos;écrire des informations
                personnelles ou confidentielles dans tes demandes : elles sont transmises à ces prestataires.
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          body: (
            <p>
              Luka utilise uniquement des cookies nécessaires à la connexion (cookie de session). Aucun cookie publicitaire ni outil de
              mesure d&apos;audience n&apos;est utilisé.
            </p>
          ),
        },
        {
          id: "conservation",
          title: "Durée de conservation",
          body: (
            <p>
              Tes données sont conservées tant que ton compte existe. Quand ton compte est supprimé, tes collectes, tes résultats et
              tes notifications sont supprimés avec lui.
            </p>
          ),
        },
        {
          id: "droits",
          title: "Tes droits",
          body: (
            <>
              <p>
                Conformément à la loi n° 29-2019 du 10 octobre 2019 portant protection des données à caractère personnel en
                République du Congo, tu peux demander à accéder à tes données, à les corriger, à les supprimer ou t&apos;opposer à leur
                traitement.
              </p>
              <p>
                Pour exercer ces droits ou supprimer ton compte, écris-nous à <Contact />. Nous répondons dans un délai raisonnable.
              </p>
            </>
          ),
        },
        {
          id: "securite",
          title: "Sécurité",
          body: (
            <p>
              Les échanges avec Luka sont chiffrés (HTTPS), les mots de passe sont stockés sous forme hachée et les tentatives de
              connexion sont limitées. Aucun système n&apos;étant parfait, préviens-nous si tu constates un problème.
            </p>
          ),
        },
        {
          id: "modifications",
          title: "Modifications",
          body: (
            <p>
              Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en haut de la page. En cas de
              changement important, nous t&apos;en informerons dans l&apos;application.
            </p>
          ),
        },
      ]}
    />
  );
}
