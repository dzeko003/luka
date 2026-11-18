import { db, schema } from "@/db";
import { llmFree } from "./config";

/**
 * Client minimal pour toute API compatible OpenAI (Groq, OpenRouter, Cerebras,
 * Ollama, Mistral…). Le fournisseur se change dans .env, sans toucher au code.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmContext = {
  userId?: string;
  collecteId?: string;
  purpose: "plan" | "extract" | "suggest";
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

/** Appelle le modèle et renvoie un objet JSON (réponse forcée au format JSON). */
export async function chatJson<T = unknown>(
  messages: ChatMessage[],
  ctx: LlmContext,
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<{ data: T; tokens: number }> {
  if (!llmFree.apiKey) {
    throw new LlmError("LLM_API_KEY manquante : configure un fournisseur d'IA dans .env.local");
  }

  const body = {
    model: llmFree.model,
    messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 2048,
    response_format: { type: "json_object" },
  };

  // Jusqu'à 4 tentatives : les offres gratuites renvoient souvent 429 (quota/minute)
  let lastErr: LlmError | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${llmFree.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmFree.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
      lastErr = new LlmError(`Fournisseur IA saturé (${res.status})`, res.status);
      await sleep(Math.min(wait, 30_000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new LlmError(`Erreur du fournisseur IA (${res.status}) : ${text.slice(0, 300)}`, res.status);
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
      provider: llmFree.provider,
      model: llmFree.model,
      purpose: ctx.purpose,
      promptTokens,
      completionTokens,
    });

    if (!content.trim()) throw new LlmError("Réponse vide du modèle (limite de taille atteinte ?)");
    return { data: parseJson<T>(content), tokens: promptTokens + completionTokens };
  }
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
