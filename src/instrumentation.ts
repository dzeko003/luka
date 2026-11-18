/**
 * Appelé une fois au démarrage du serveur Next.js : lance la file d'attente des collectes.
 * Uniquement côté Node.js (le travailleur utilise la base de données et des minuteries longues).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.LUKA_WORKER === "off") return;
  const { startWorker } = await import("./lib/worker");
  startWorker();
}
