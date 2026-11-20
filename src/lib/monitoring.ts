/**
 * Signalement des erreurs du serveur à Sentry, seulement si SENTRY_DSN est défini (production).
 * Aucune donnée personnelle n'est envoyée : ni adresse IP, ni cookies, ni corps des requêtes.
 */
import * as Sentry from "@sentry/nextjs";

export const monitoringEnabled = Boolean(process.env.SENTRY_DSN);

export function initMonitoring() {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    release: process.env.LUKA_VERSION || undefined,
    serverName: process.env.LUKA_WORKER === "off" ? "luka-web" : "luka-worker",
    // Aucune donnée sur les visiteurs : ni utilisateur, ni cookies, ni en-têtes, ni corps, ni paramètres d'URL
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
    },
    // Erreurs seulement : pas de suivi des performances
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.headers;
      }
      delete event.user;
      return event;
    },
  });
}

/** Signale une erreur attrapée par le code (travailleur, tâches de fond), avec un contexte court. */
export function reportError(e: unknown, context: Record<string, string | number | undefined> = {}) {
  if (!monitoringEnabled) return;
  Sentry.captureException(e, { tags: Object.fromEntries(Object.entries(context).filter(([, v]) => v !== undefined)) });
}

export const captureRequestError = Sentry.captureRequestError;
