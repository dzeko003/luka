import type { Instrumentation } from "next";

/**
 * Appelé une fois au démarrage du serveur Next.js : active le signalement des erreurs (Sentry) puis lance
 * la file d'attente des collectes. Uniquement côté Node.js (le travailleur utilise la base de données et des
 * minuteries longues).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initMonitoring } = await import("./lib/monitoring");
  initMonitoring();
  if (process.env.LUKA_WORKER === "off") return;
  const { startWorker } = await import("./lib/worker");
  startWorker();
}

/** Erreurs des pages, routes API et actions serveur : signalées à Sentry. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;
  const { captureRequestError } = await import("./lib/monitoring");
  captureRequestError(err, request, context);
};
