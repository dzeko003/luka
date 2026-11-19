import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LogEntry } from "@/db/schema";
import { limits } from "./config";
import { runCollecte } from "./engine";

/**
 * File d'attente des collectes, stockée dans PostgreSQL (aucun service en plus).
 * - L'API crée la collecte avec le statut « pending » et rend la main tout de suite.
 * - Le travailleur, lancé au démarrage du serveur, prend les collectes une à une
 *   (FOR UPDATE SKIP LOCKED : plusieurs serveurs peuvent tourner sans se marcher dessus).
 * - Pendant l'exécution, il met à jour un « signal de vie » : une collecte dont le signal
 *   s'arrête (serveur redémarré, plantage) est relancée, ou marquée en échec après 2 essais.
 * - En production, il tourne dans son propre conteneur (service « worker ») : à l'arrêt
 *   (SIGTERM, lors d'un déploiement), il ne prend plus de nouvelle collecte et termine celles
 *   en cours avant de s'arrêter. Pendant ce temps, le nouveau travailleur prend les suivantes.
 */

const POLL_MS = 2000;
const HEARTBEAT_MS = 30_000;
const DEAD_AFTER_MS = 3 * 60_000;
const MAX_ATTEMPTS = 2;

const entry = (message: string, level: LogEntry["level"] = "info") =>
  sql`${schema.collectes.log} || ${JSON.stringify([{ at: new Date().toISOString(), message, level }])}::jsonb`;

/** Prend la plus ancienne collecte en attente, de façon atomique. */
async function claimNext() {
  const [c] = await db.execute<{ id: string }>(sql`
    update collectes set status = 'running', started_at = coalesce(started_at, now()), heartbeat_at = now(),
      attempts = attempts + 1
    where id = (
      select id from collectes where status = 'pending' order by created_at
      for update skip locked limit 1
    )
    returning id`);
  return c?.id ?? null;
}

/** Collectes dont le travailleur a disparu : relancées depuis le début, ou abandonnées. */
async function recoverDead() {
  const cutoff = new Date(Date.now() - DEAD_AFTER_MS);
  const dead = await db
    .select({ id: schema.collectes.id, attempts: schema.collectes.attempts })
    .from(schema.collectes)
    .where(and(eq(schema.collectes.status, "running"), lt(schema.collectes.heartbeatAt, cutoff)));
  for (const c of dead) {
    if (c.attempts < MAX_ATTEMPTS) {
      await db.delete(schema.rows).where(eq(schema.rows.collecteId, c.id));
      await db
        .update(schema.collectes)
        .set({ status: "pending", progress: 0, log: entry("Collecte interrompue : reprise depuis le début.", "warn") })
        .where(and(eq(schema.collectes.id, c.id), eq(schema.collectes.status, "running")));
    } else {
      await db
        .update(schema.collectes)
        .set({
          status: "failed",
          error: "Collecte interrompue à plusieurs reprises",
          finishedAt: new Date(),
          log: entry("Collecte interrompue à plusieurs reprises : abandon.", "error"),
        })
        .where(eq(schema.collectes.id, c.id));
    }
  }
}

async function runOne(id: string) {
  const beat = setInterval(() => {
    db.update(schema.collectes)
      .set({ heartbeatAt: new Date() })
      .where(eq(schema.collectes.id, id))
      .catch(() => {});
  }, HEARTBEAT_MS);
  try {
    await runCollecte(id);
  } catch (e) {
    // runCollecte gère ses erreurs ; ceci ne couvre que l'imprévu (base indisponible…)
    console.error("[worker] collecte", id, e);
    await db
      .update(schema.collectes)
      .set({ status: "failed", error: (e as Error).message, finishedAt: new Date() })
      .where(and(eq(schema.collectes.id, id), inArray(schema.collectes.status, ["running", "pending"])))
      .catch(() => {});
  } finally {
    clearInterval(beat);
  }
}

type WorkerState = { running: number; started: boolean; draining: boolean };
const state = globalThis as unknown as { lukaWorker?: WorkerState };

/** Arrêt propre : plus de nouvelle collecte, on attend la fin de celles en cours, puis on quitte. */
function drainOnSignal(w: WorkerState) {
  const stop = (signal: string) => {
    if (w.draining) return;
    w.draining = true;
    console.log(`[worker] ${signal} reçu : ${w.running} collecte(s) en cours, arrêt dès qu'elles sont terminées`);
    const wait = setInterval(() => {
      if (w.running > 0) return;
      clearInterval(wait);
      console.log("[worker] collectes terminées, arrêt");
      process.exit(0);
    }, 1000);
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}

/** Démarre la boucle (une seule fois par processus, même avec les rechargements à chaud). */
export function startWorker() {
  if (state.lukaWorker?.started) return;
  const w = (state.lukaWorker = { running: 0, started: true, draining: false });
  // Next.js quitte immédiatement sur SIGTERM, sauf si NEXT_MANUAL_SIG_HANDLE est défini (conteneur « worker »)
  if (process.env.NEXT_MANUAL_SIG_HANDLE) drainOnSignal(w);
  let lastRecovery = 0;

  const tick = async () => {
    try {
      if (Date.now() - lastRecovery > 60_000) {
        lastRecovery = Date.now();
        await recoverDead();
      }
      while (!w.draining && w.running < limits.workerConcurrency) {
        const id = await claimNext();
        if (!id) break;
        w.running++;
        runOne(id).finally(() => w.running--);
      }
    } catch (e) {
      console.error("[worker]", (e as Error).message);
    } finally {
      setTimeout(tick, POLL_MS).unref();
    }
  };
  console.log(`[worker] file d'attente des collectes démarrée (${limits.workerConcurrency} en parallèle)`);
  setTimeout(tick, 1000).unref();
}
