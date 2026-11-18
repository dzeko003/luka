import { and, asc, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import { apiUser, getOwnedCollecte, jsonError } from "@/lib/api";
import { rowsWhere } from "@/lib/rows-query";

type Ctx = { params: Promise<{ id: string }> };

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  // Protection contre l'injection de formules dans Excel (sauf les nombres, ex. latitude -4,27)
  if (typeof v !== "number" && !/^-?\d+([.,]\d+)?$/.test(s) && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const CHUNK = 2000;

/**
 * Export en flux : les lignes sont lues et envoyées par paquets de 2 000, la mémoire du
 * serveur reste stable même pour des dizaines de milliers de lignes.
 */
export async function GET(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return jsonError("Connexion requise", 401);
  const c = await getOwnedCollecte((await params).id, user.id);
  if (!c) return jsonError("Collecte introuvable", 404);

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const onlyValid = url.searchParams.get("valides") === "1";
  const where = rowsWhere(c.id, { status: onlyValid ? "valide" : null, excludeRejected: true });
  const slug = c.title.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "collecte";

  const csvLine = (r: typeof schema.rows.$inferSelect) =>
    [
      ...c.columns.map((col) => r.data[col.name]),
      r.sourceUrl ?? r.sourceTitle ?? "",
      r.confidence !== null ? Math.round(r.confidence * 100) + " %" : "",
      r.status,
    ]
      .map(csvCell)
      .join(";");

  const encoder = new TextEncoder();
  let lastPosition = -1;
  let first = true;
  let done = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (done) return controller.close();
      if (first) {
        // BOM UTF-8 + séparateur « ; » : s'ouvre correctement dans Excel en français
        const head =
          format === "json"
            ? "["
            : "﻿" + [...c.columns.map((col) => col.label), "Source", "Confiance", "Statut"].map(csvCell).join(";");
        controller.enqueue(encoder.encode(head));
      }
      const rows = await db
        .select()
        .from(schema.rows)
        .where(and(where, gt(schema.rows.position, lastPosition)))
        .orderBy(asc(schema.rows.position))
        .limit(CHUNK);
      if (rows.length) lastPosition = rows.at(-1)!.position;
      const body =
        format === "json"
          ? rows
              .map((r, i) =>
                (first && i === 0 ? "\n" : ",\n") +
                JSON.stringify({ ...r.data, _source: r.sourceUrl, _confiance: r.confidence, _statut: r.status }),
              )
              .join("")
          : rows.map((r) => "\r\n" + csvLine(r)).join("");
      first = false;
      if (rows.length < CHUNK) {
        done = true;
        controller.enqueue(encoder.encode(body + (format === "json" ? "\n]\n" : "\r\n")));
      } else controller.enqueue(encoder.encode(body));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.${format}"`,
    },
  });
}
