/**
 * Erreurs du navigateur signalées à Sentry, seulement si NEXT_PUBLIC_SENTRY_DSN a été fourni au build
 * (production). Le module Sentry est chargé après l'affichage, pour ne pas ralentir la page.
 * Aucune donnée sur le visiteur : ni compte, ni IP, ni cookies, ni enregistrement de session.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: "production",
        release: process.env.NEXT_PUBLIC_LUKA_VERSION || undefined,
        // Erreurs seulement : pas de suivi des performances ni d'enregistrement des sessions
        tracesSampleRate: 0,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
        // Erreurs sans intérêt : extensions du navigateur, coupures réseau, bruit connu des navigateurs
        ignoreErrors: [/ResizeObserver loop/, /^Load failed$/, /^Failed to fetch$/, /NetworkError when attempting to fetch/, /AbortError/],
        denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-(web-)?extension:\/\//],
        beforeSend(event) {
          delete event.user;
          if (event.request) {
            delete event.request.cookies;
            delete event.request.headers;
            // Adresse de la page sans les paramètres (jetons de lien, recherches)
            if (event.request.url) event.request.url = event.request.url.split(/[?#]/)[0];
            delete event.request.query_string;
          }
          return event;
        },
      }),
    )
    .catch(() => {});
}
