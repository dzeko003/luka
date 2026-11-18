import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Authentification (tables attendues par Better Auth)                 */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Champs propres à Luka
  plan: text("plan").notNull().default("free"), // free | premium
  credits: integer("credits").notNull().default(0), // crédits premium (V2)
  role: text("role").notNull().default("member"), // member | admin
  blocked: boolean("blocked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Collectes                                                           */
/* ------------------------------------------------------------------ */

export type ColumnType = "texte" | "nombre" | "url" | "date" | "booleen";

export type ColumnDef = {
  name: string; // identifiant (snake_case)
  label: string; // libellé affiché
  type: ColumnType;
  description?: string; // aide pour l'IA
  field?: string; // champ de lieu (PLACE_FIELDS) qui remplit cette colonne automatiquement
};

export type LogEntry = { at: string; message: string; level?: "info" | "warn" | "error" };

export const collectes = pgTable(
  "collectes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    request: text("request").notNull(), // demande en langage naturel
    columns: jsonb("columns").$type<ColumnDef[]>().notNull(),
    maxRows: integer("max_rows").notNull().default(20),
    tier: text("tier").notNull().default("free"), // free | premium
    status: text("status").notNull().default("pending"), // pending | running | done | failed
    log: jsonb("log").$type<LogEntry[]>().notNull().default([]),
    error: text("error"),
    progress: integer("progress").notNull().default(0), // 0 → 100, affiché pendant la collecte
    heartbeatAt: timestamp("heartbeat_at"), // signal de vie du travailleur : détecte un serveur redémarré
    attempts: integer("attempts").notNull().default(0), // reprises après interruption
    llmCalls: integer("llm_calls").notNull().default(0),
    tokensUsed: integer("tokens_used").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0), // dépense des sources payantes (Apify), en dollars
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("collectes_user_idx").on(t.userId, t.createdAt), index("collectes_queue_idx").on(t.status, t.createdAt)],
);

export const rows = pgTable(
  "rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collecteId: uuid("collecte_id")
      .notNull()
      .references(() => collectes.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, string | number | boolean | null>>().notNull(),
    sourceUrl: text("source_url"),
    sourceTitle: text("source_title"),
    confidence: real("confidence"), // 0 → 1
    status: text("status").notNull().default("a_verifier"), // a_verifier | valide | rejete
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("rows_collecte_idx").on(t.collecteId, t.position)],
);

/* Journal de chaque appel IA : suivi des coûts et plafond global */
export const llmUsage = pgTable(
  "llm_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    collecteId: uuid("collecte_id").references(() => collectes.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    purpose: text("purpose").notNull(), // plan | extract | suggest
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("llm_usage_created_idx").on(t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read)],
);
