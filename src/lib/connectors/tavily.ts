import { tavilyKey } from "../config";
import type { Connector, SourceDocument } from "./types";

type TavilyResult = { url: string; title: string; content: string; raw_content?: string | null };

/** Recherche web via Tavily (https://tavily.com) : renvoie le texte des pages trouvées. */
export const tavilyConnector: Connector = {
  id: "web",
  label: "Recherche web (Tavily)",
  isAvailable: () => Boolean(tavilyKey),

  async search(query, { maxResults, maxChars }) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyKey}` },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: "basic",
        include_raw_content: "text",
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Recherche web en échec (${res.status}) : ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { results?: TavilyResult[] };
    return (json.results ?? []).map(
      (r): SourceDocument => ({
        url: r.url,
        title: r.title,
        // Le texte complet si disponible, sinon l'extrait ; tronqué pour tenir dans les quotas gratuits
        content: (r.raw_content || r.content || "").replace(/\s+/g, " ").slice(0, maxChars),
      }),
    );
  },
};
