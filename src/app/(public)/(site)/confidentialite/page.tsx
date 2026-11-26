import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updated="26 novembre 2026"
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
                <strong>Connexions</strong> : la date, le moyen de connexion (email, Google) et le pays déduit de l&apos;adresse IP,
                pour repérer une utilisation anormale de ton compte.
              </li>
              <li>
                <strong>Visites de la page d&apos;accueil</strong> : la date, le site d&apos;où tu viens et ton pays, déduit de ton
                adresse IP. L&apos;adresse IP elle-même n&apos;est pas conservée et aucun cookie n&apos;est déposé : seule une empreinte
                anonyme, renouvelée chaque jour, permet de compter les visiteurs uniques.
              </li>
              <li>
                <strong>Paiements</strong> : le montant, la date et le moyen de paiement des formules Premium.
              </li>
              <li>
                <strong>Contributions</strong> : les fichiers d&apos;établissements que tu choisis d&apos;envoyer pour enrichir la base
                Luka, avec leur titre, leur origine indiquée et la décision de l&apos;équipe.
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
          id: "base",
          title: "Base Luka : réutilisation des données publiques",
          body: (
            <>
              <p>
                Luka constitue une base commune d&apos;établissements (commerces, entreprises, écoles, services…) pour que les collectes de
                chacun soient plus rapides et plus fiables. Elle est alimentée de deux façons :
              </p>
              <ul>
                <li>
                  <strong>Les lignes que tu valides</strong>, si tu l&apos;acceptes. Ce partage est activé par défaut pour les nouvelles
                  collectes ; tu peux le désactiver à tout moment dans Mon compte, ou collecte par collecte. Un fichier que tu importes pour
                  le compléter n&apos;est jamais partagé sans que tu coches la case prévue.
                </li>
                <li>
                  <strong>Les contributions</strong> : les fichiers que tu envoies volontairement depuis la page Contribuer, vérifiés par
                  l&apos;équipe Luka avant d&apos;être ajoutés.
                </li>
              </ul>
              <p>
                Seules des informations publiques d&apos;établissements y entrent : nom, catégorie, adresse, téléphone, site web, e-mail
                de contact, réseaux sociaux, horaires. Les colonnes qui décrivent une personne (nom d&apos;un responsable, données
                personnelles) sont écartées, de même que les informations issues de Google Maps. La base ne garde ni ton nom ni le titre de ta collecte : seulement les informations et le
                nombre de fois où elles ont été confirmées. Ces informations peuvent apparaître dans les résultats des autres
                utilisateurs, avec la mention « Base Luka ».
              </p>
              <p>
                La base peut aussi contenir des <strong>organisations</strong> (universités, institutions…), des{" "}
                <strong>publications</strong> (articles, thèses, rapports) et les <strong>auteurs</strong> de ces publications. Une
                personne n&apos;y figure que sous son identité professionnelle publique, telle qu&apos;elle signe ses travaux : nom,
                identifiant ORCID, discipline et affiliation. Luka n&apos;y garde jamais son téléphone, son e-mail, son adresse ni sa
                photo, même si une source les publie.
              </p>
              <p>
                Un établissement ou une personne qui souhaite faire retirer ou corriger une information peut nous écrire à <Contact /> :
                la fiche est corrigée ou supprimée, avec ses liens (par exemple, une personne et la liste de ses publications).
              </p>
            </>
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
                  <strong>OpenAlex</strong>, la base ouverte des publications scientifiques : reçoit les disciplines, mots-clés, pays et
                  dates tirés d&apos;une demande de publications.
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
              mesure d&apos;audience externe n&apos;est utilisé : le comptage des visites de la page d&apos;accueil est fait par Luka
              elle-même, sans cookie.
            </p>
          ),
        },
        {
          id: "conservation",
          title: "Durée de conservation",
          body: (
            <p>
              Tes données sont conservées tant que ton compte existe. Quand ton compte est supprimé, tes collectes, tes résultats,
              tes contributions et tes notifications sont supprimés avec lui. Les informations d&apos;établissements déjà versées dans
              la base Luka y restent, car elles ne sont plus liées à ton compte ; tu peux demander leur retrait à <Contact />.
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
