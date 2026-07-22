import { pgTable, text, timestamp, boolean, index, uuid } from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────
// Better Auth core-таблицы (имена/поля фиксированы контрактом BA).
// role — наш additionalField (см. auth.ts), пользователь его не задаёт.
// ─────────────────────────────────────────────────────────────
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Управляется admin-плагином Better Auth (defaultRole "user", adminRoles ["admin"]).
  role: text("role").notNull().default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  // Момент принятия пользовательского соглашения/политики (ставится при регистрации).
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byUser: index("session_user_idx").on(t.userId) })
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byUser: index("account_user_idx").on(t.userId) })
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byIdent: index("verification_ident_idx").on(t.identifier) })
);

// ─────────────────────────────────────────────────────────────
// Доменные таблицы oko-cloud. userId → Better Auth user.id (text).
// ─────────────────────────────────────────────────────────────
export const bridges = pgTable("bridges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Bridge"),
  // pairingCode — одноразовый (после привязки → null) и с TTL (pairingExpiresAt).
  pairingCode: text("pairing_code").unique(),
  pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }),
  token: text("token").notNull().unique(),
  pairedAt: timestamp("paired_at", { withTimezone: true }),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cameras = pgTable(
  "cameras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    bridgeId: uuid("bridge_id").references(() => bridges.id, { onDelete: "set null" }),
    name: text("name").notNull().default("Камера"),
    path: text("path").notNull().unique(),
    publishToken: text("publish_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byUser: index("cameras_user_idx").on(t.userId) })
);

export const viewTokens = pgTable(
  "view_tokens",
  {
    token: text("token").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    cameraId: uuid("camera_id").references(() => cameras.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byExpiry: index("view_tokens_expiry_idx").on(t.expiresAt) })
);

export const viewAudit = pgTable(
  "view_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    actorRole: text("actor_role").notNull(),
    cameraPath: text("camera_path").notNull(),
    action: text("action").notNull(),
    ip: text("ip"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byCamera: index("view_audit_camera_idx").on(t.cameraPath) })
);
