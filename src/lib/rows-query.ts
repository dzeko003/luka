import { and, eq, isNotNull, ne, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";

export const ROW_STATUSES = ["a_verifier", "valide", "rejete"] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

/** Filtre commun (tableau, actions groupées, export) : statut (ou « changements » de la dernière mise à jour) et recherche dans toutes les colonnes. */
export function rowsWhere(collecteId: string, opts: { status?: string | null; q?: string | null; excludeRejected?: boolean }) {
  const conds: SQL[] = [eq(schema.rows.collecteId, collecteId)];
  if (opts.status === "changements") conds.push(isNotNull(schema.rows.change));
  else if (opts.status && (ROW_STATUSES as readonly string[]).includes(opts.status)) conds.push(eq(schema.rows.status, opts.status));
  else if (opts.excludeRejected) conds.push(ne(schema.rows.status, "rejete"));
  const q = opts.q?.trim().slice(0, 100);
  if (q) {
    // Recherche dans les valeurs (pas dans les noms de colonnes), insensible à la casse
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    conds.push(sql`exists (select 1 from jsonb_each_text(${schema.rows.data}) e where e.value ilike ${like})`);
  }
  return and(...conds)!;
}
