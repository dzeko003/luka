import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { EntityType, Relation } from "@/lib/kb-fields";

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
  shareData: boolean("share_data").notNull().default(true), // partage des lignes validées avec la base Luka
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
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
  // Session ouverte avec le mot de passe ET le code Google Authenticator : seule clé de la console admin
  mfaVerified: boolean("mfa_verified").notNull().default(false),
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

/** Double authentification (plugin twoFactor de Better Auth) : secret TOTP et codes de secours, chiffrés. */
export const twoFactor = pgTable(
  "two_factor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until"),
  },
  (t) => [index("two_factor_user_id_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)],
);

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
  fromFile?: boolean; // enrichissement : colonne du fichier importé (gardée telle quelle, jamais remplie)
};

/** Bilan de la dernière mise à jour automatique. */
export type RefreshChanges = { nouveau: number; modifie: number; nonRetrouve: number };

export type LogEntry = { at: string; message: string; level?: "info" | "warn" | "error" };

export const collectes = pgTable(
  "collectes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    request: text("request").notNull(), // demande en langage naturel (enrichissement : ce que sont les lignes)
    kind: text("kind").notNull().default("collecte"), // collecte | enrichissement
    input: jsonb("input").$type<Record<string, string>[]>(), // enrichissement : lignes du fichier importé
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
    // Mise à jour automatique : la collecte est relancée et les changements sont marqués sur ses lignes
    refresh: text("refresh").notNull().default("aucune"), // aucune | hebdo | mensuelle
    nextRefreshAt: timestamp("next_refresh_at"),
    lastRefreshAt: timestamp("last_refresh_at"),
    refreshing: boolean("refreshing").notNull().default(false), // l'exécution en cours est une mise à jour
    lastChanges: jsonb("last_changes").$type<RefreshChanges>(),
    // Base Luka : les lignes validées sont partagées (si l'utilisateur l'accepte) ; zone trouvée par l'analyse de la demande
    shareData: boolean("share_data").notNull().default(false),
    zone: text("zone"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("collectes_user_idx").on(t.userId, t.createdAt),
    index("collectes_queue_idx").on(t.status, t.createdAt),
    index("collectes_refresh_idx").on(t.nextRefreshAt),
  ],
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
    // Mise à jour automatique : changement constaté lors de la dernière mise à jour, et valeurs d'avant
    change: text("change"), // nouveau | modifie | non_retrouve
    previous: jsonb("previous").$type<Record<string, string | number | boolean | null>>(),
    edited: jsonb("edited").$type<string[]>().notNull().default([]), // colonnes corrigées à la main : jamais écrasées
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

/* ------------------------------------------------------------------ */
/* Statistiques de la console d'administration                         */
/* ------------------------------------------------------------------ */

/** Visites de la page d'accueil : pays déduit de l'adresse IP, qui n'est pas conservée. */
export const visits = pgTable(
  "visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: text("path").notNull(),
    country: text("country"), // code ISO à deux lettres, null si inconnu
    visitor: text("visitor").notNull(), // empreinte anonyme, renouvelée chaque jour (visiteurs uniques)
    referrer: text("referrer"), // domaine d'origine
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("visits_created_idx").on(t.createdAt)],
);

/** Journal des connexions réussies (e-mail, Google, code de double authentification, lien d'activation). */
export const logins = pgTable(
  "logins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    method: text("method").notNull(), // email | google | 2fa | lien
    country: text("country"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("logins_user_idx").on(t.userId, t.createdAt), index("logins_created_idx").on(t.createdAt)],
);

/** Paiements reçus (saisis par un administrateur en attendant le paiement Mobile Money intégré). */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // en FCFA
    method: text("method").notNull(), // mobile_money | especes | virement | autre
    note: text("note"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("payments_user_idx").on(t.userId, t.createdAt), index("payments_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Base Luka : lieux, organisations, personnes et publications connus  */
/* ------------------------------------------------------------------ */

/** Une information d'une fiche : valeur, nombre de confirmations, dernière fois vue, origine. */
export type KbValue = { v: string | number; n: number; at: string; src: string; url?: string | null };

/**
 * Une fiche de la base commune. Le type dit ce qu'elle décrit (lieu, organisation, personne, publication) ;
 * les colonnes communes servent à chercher, `fields` garde tout le reste avec sa provenance.
 * La table garde son nom d'origine (kb_entities) : un ancien travailleur encore en service la retrouve.
 */
export const entities = pgTable(
  "kb_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<EntityType>().notNull().default("lieu"),
    // Unique pour un type : nom|ville pour un lieu, doi:… pour une publication, orcid:… pour une personne…
    key: text("key").notNull(),
    name: text("name").notNull(), // nom du lieu, de l'organisation ou de la personne ; titre d'une publication
    city: text("city"), // obligatoire pour un lieu, facultative ailleurs
    category: text("category"), // catégorie d'un lieu, discipline d'une publication…
    fields: jsonb("fields").$type<Record<string, KbValue>>().notNull().default({}),
    confirmations: integer("confirmations").notNull().default(1), // nombre de collectes ou contributions qui l'ont confirmé
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("kb_type_key_idx").on(t.type, t.key), index("kb_type_city_idx").on(t.type, t.city)],
);

/** Liens entre fiches : une personne est l'auteur d'une publication, membre d'une organisation… */
export const entityLinks = pgTable(
  "entity_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromId: uuid("from_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    relation: text("relation").$type<Relation>().notNull(),
    toId: uuid("to_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    src: text("src").notNull(),
    confirmations: integer("confirmations").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("entity_links_unique_idx").on(t.fromId, t.relation, t.toId), index("entity_links_to_idx").on(t.toId)],
);

/** Fichiers envoyés par les utilisateurs pour enrichir la base, en attente de modération. */
export const contributions = pgTable(
  "contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    city: text("city").notNull(),
    category: text("category"),
    fileName: text("file_name").notNull(),
    rows: jsonb("rows").$type<Record<string, string>[]>().notNull(), // déjà associées aux champs de la base
    rowCount: integer("row_count").notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    reviewNote: text("review_note"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    added: integer("added").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("contributions_status_idx").on(t.status, t.createdAt), index("contributions_user_idx").on(t.userId)],
);

/* Réglages modifiables depuis la console d'administration (limites des formules, plafonds de dépense).
   Une clé absente reprend la valeur par défaut, lue dans l'environnement. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: real("value").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
