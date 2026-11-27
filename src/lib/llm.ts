import { db, schema } from "@/db";
import { type LlmProvider, llmProviders } from "./config";

/**
 * Client minimal pour toute API compatible OpenAI (Groq, OpenRouter, Cerebras,
 * Ollama, Mistral…). Le fournisseur se change dans .env, sans toucher au code.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmContext = {
  userId?: string;
  collecteId?: string;
  purpose: "plan" | "extract" | "suggest" | "enrich";
};

export class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Durée renvoyée par le fournisseur (« 7.66s », « 1m26.4s », « 577ms » ou un nombre de secondes) → millisecondes. */
export function parseDuration(v: string | null): number | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s) * 1000;
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/);
  if (!m || !s) return null;
  const [, h, min, sec, ms] = m;
  return ((Number(h ?? 0) * 60 + Number(min ?? 0)) * 60 + Number(sec ?? 0)) * 1000 + Number(ms ?? 0);
}

/** Estimation grossière : environ 4 caractères par token, plus la réponse attendue. */
const estimateTokens = (messages: ChatMessage[], maxTokens: number) =>
  Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + Math.min(maxTokens, 1500);
/** Au-delà, attendre ne vaut pas le coup : le fournisseur est mis de côté jusqu'à sa recharge. */
const MAX_WAIT_MS = 65_000;

/**
 * État de chaque fournisseur, partagé par toutes les collectes du processus. Les offres gratuites limitent les
 * tokens par minute et par jour : on retient ce que le fournisseur annonce (tokens restants, délai de recharge)
 * et on passe au suivant plutôt que d'attendre, sauf si tous sont momentanément pleins.
 */
type ProviderState = { remaining: number; resetAt: number; blockedUntil: number; json: boolean; why?: string };
const states = new Map<string, ProviderState>();
const stateOf = (p: LlmProvider) => {
  let st = states.get(p.name);
  if (!st) states.set(p.name, (st = { remaining: Infinity, resetAt: 0, blockedUntil: 0, json: true }));
  return st;
};

/** Moment où le fournisseur peut recevoir une requête de `needed` tokens. */
function readyAt(p: LlmProvider, needed: number, now: number) {
  const st = stateOf(p);
  if (st.resetAt <= now) st.remaining = Infinity;
  const budgetAt = needed > st.remaining ? st.resetAt : now;
  return Math.max(st.blockedUntil, budgetAt);
}

function rememberBudget(st: ProviderState, headers: Headers) {
  if (!headers.has("x-ratelimit-remaining-tokens")) return;
  const remaining = Number(headers.get("x-ratelimit-remaining-tokens"));
  if (!Number.isFinite(remaining)) return;
  st.remaining = remaining;
  st.resetAt = Date.now() + (parseDuration(headers.get("x-ratelimit-reset-tokens")) ?? 60_000);
}

function setAside(p: LlmProvider, ms: number, why: string) {
  const st = stateOf(p);
  st.blockedUntil = Date.now() + ms;
  st.why = why;
  if (ms > MAX_WAIT_MS) console.warn(`[llm] ${p.name} mis de côté ${Math.round(ms / 60_000)} min : ${why}`);
}

/** Fournisseurs configurés et leur état (pour l'administration et les tests). */
export function providersStatus() {
  const now = Date.now();
  return llmProviders.map((p) => {
    const st = stateOf(p);
    return { name: p.name, available: st.blockedUntil <= now, until: st.blockedUntil > now ? new Date(st.blockedUntil) : null, why: st.why };
  });
}

/** Appelle le modèle et renvoie un objet JSON. En cas de saturation, les fournisseurs suivants prennent le relais. */
export async function chatJson<T = unknown>(
  messages: ChatMessage[],
  ctx: LlmContext,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<{ data: T; tokens: number }> {
  if (!llmProviders.length) {
    throw new LlmError("LLM_API_KEY manquante : configure un fournisseur d'IA dans .env.local");
  }
  const maxTokens = opts.maxTokens ?? 2048;
  const needed = estimateTokens(messages, maxTokens);
  let lastErr: LlmError | undefined;
  const maxAttempts = llmProviders.length * 3 + 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Le premier fournisseur disponible dans l'ordre ; sinon celui qui se libère le plus tôt, s'il vaut l'attente
    const now = Date.now();
    const ranked = llmProviders.map((p) => ({ p, at: readyAt(p, needed, now) }));
    const pick = ranked.find((r) => r.at <= now) ?? [...ranked].sort((a, b) => a.at - b.at)[0];
    const wait = pick.at - now;
    if (wait > MAX_WAIT_MS) break;
    if (wait > 0) await sleep(wait + 250);
    const p = pick.p;
    const st = stateOf(p);

    let res: Response;
    try {
      res = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model,
          messages,
          temperature: opts.temperature ?? 0.1,
          max_tokens: maxTokens,
          ...(st.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      lastErr = new LlmError(`Fournisseur IA injoignable (${p.provider}) : ${(e as Error).message}`);
      setAside(p, 60_000, "injoignable");
      continue;
    }
    rememberBudget(st, res.headers);

    if (res.status === 429 || res.status >= 500) {
      // Délai annoncé par le fournisseur ; sinon une minute (recharge des limites par minute)
      const announced = parseDuration(res.headers.get("retry-after")) ?? parseDuration(res.headers.get("x-ratelimit-reset-tokens"));
      const ms = announced ?? (res.status === 429 ? 60_000 : 30_000);
      const daily = ms > MAX_WAIT_MS;
      lastErr = new LlmError(`Fournisseur IA saturé (${res.status})${daily ? " : limite journalière atteinte" : ""}`, res.status);
      setAside(p, ms, daily ? "limite journalière" : `saturé (${res.status})`);
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Certains fournisseurs ou modèles refusent le format JSON imposé : on le retire pour eux
      if (res.status === 400 && st.json && /response_format|json/i.test(text)) {
        st.json = false;
        continue;
      }
      lastErr = new LlmError(`Erreur du fournisseur IA (${res.status}) : ${text.slice(0, 300)}`, res.status);
      // Clé refusée, modèle inconnu… : ce fournisseur est écarté une heure, les autres prennent le relais
      setAside(p, [401, 403, 404].includes(res.status) ? 3_600_000 : 300_000, `erreur ${res.status}`);
      continue;
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const promptTokens = json.usage?.prompt_tokens ?? 0;
    const completionTokens = json.usage?.completion_tokens ?? 0;

    await db.insert(schema.llmUsage).values({
      userId: ctx.userId,
      collecteId: ctx.collecteId,
      provider: p.provider,
      model: p.model,
      purpose: ctx.purpose,
      promptTokens,
      completionTokens,
    });

    if (!content.trim()) throw new LlmError("Réponse vide du modèle (limite de taille atteinte ?)");
    return { data: parseJson<T>(content), tokens: promptTokens + completionTokens };
  }
  if (llmProviders.length > 1 && lastErr) lastErr = new LlmError(`Tous les fournisseurs d'IA sont saturés. ${lastErr.message}`, lastErr.status);
  throw lastErr ?? new LlmError("Fournisseur IA indisponible");
}

/** Certains modèles entourent le JSON de texte ou de ```json … ``` : on l'isole. */
function parseJson<T>(content: string): T {
  const cleaned = content.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* on tombe sur l'erreur ci-dessous */
      }
    }
    throw new LlmError("Le modèle n'a pas renvoyé de JSON valide");
  }
}
