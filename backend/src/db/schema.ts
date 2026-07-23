import { pgTable, text, timestamp, boolean, index, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
  // Telegram для уведомлений о движении (Этап 3). Привязка по deep-link коду → chatId.
  telegramChatId: text("telegram_chat_id"),
  telegramLinkCode: text("telegram_link_code"),
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
  // Токен генерится при /pair; в БД только SHA-256 хэш (сырой показан один раз). token — legacy, nullable.
  token: text("token").unique(),
  tokenHash: text("token_hash").unique(),
  tokenPrefix: text("token_prefix"), // "okb_xxxx" для UI/логов, без секрета
  revokedAt: timestamp("revoked_at", { withTimezone: true }), // мгновенный отзыв, привязки камер не рушит
  agentVersion: text("agent_version"),
  lastIp: text("last_ip"),
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
    // sourceUrl — RTSP камеры с логином/паролем, зашифрован AES-256-GCM (iv.tag.ct base64). NULL для ONVIF/ручного flow.
    sourceUrl: text("source_url"),
    // ── ONVIF-режим (Этап 2): агент резолвит RTSP через GetStreamUri по этим полям ──
    // deviceKey — стабильный ONVIF-urn устройства (ключ дедупа при повторном обнаружении).
    deviceKey: text("device_key"),
    // onvifUrl — xaddr (device_service URL) камеры; onvifCreds — зашифрованный JSON {u,p}.
    onvifUrl: text("onvif_url"),
    onvifCreds: text("onvif_creds"),
    enabled: boolean("enabled").notNull().default(true), // desired-state для агента
    // ── Умная запись по движению (Этап 3) ──
    // recordMode: "continuous" — писать 24/7 (default, безопасно); "motion" — только при движении.
    recordMode: text("record_mode").notNull().default("continuous"),
    notifyEnabled: boolean("notify_enabled").notNull().default(false), // Telegram-алерт на движение
    lastMotionAt: timestamp("last_motion_at", { withTimezone: true }), // последний пинг движения; гейт записи деривируем
    lastSeen: timestamp("last_seen", { withTimezone: true }), // последний heartbeat с этой камерой; online деривируем
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUser: index("cameras_user_idx").on(t.userId),
    byBridge: index("cameras_bridge_idx").on(t.bridgeId),
    // Идемпотентность усыновления: одну физическую ONVIF-камеру нельзя добавить дважды на один bridge.
    byDevice: uniqueIndex("cameras_bridge_device_idx").on(t.bridgeId, t.deviceKey).where(sql`device_key IS NOT NULL`),
  })
);

// ─────────────────────────────────────────────────────────────
// discovered_cameras — «входящие» от агента: ONVIF-камеры, найденные в LAN.
// Заполняется на heartbeat, показывается в ЛК. Усыновление → строка cameras + cameraId здесь.
// ─────────────────────────────────────────────────────────────
export const discoveredCameras = pgTable(
  "discovered_cameras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bridgeId: uuid("bridge_id").notNull().references(() => bridges.id, { onDelete: "cascade" }),
    deviceKey: text("device_key").notNull(), // ONVIF urn (EndpointReference/Address)
    name: text("name"),
    manufacturer: text("manufacturer"),
    model: text("model"),
    ip: text("ip"),
    onvifUrl: text("onvif_url").notNull(), // xaddr
    cameraId: uuid("camera_id").references(() => cameras.id, { onDelete: "set null" }), // усыновлена → id камеры
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }), // пользователь скрыл
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byBridgeDevice: uniqueIndex("discovered_bridge_device_idx").on(t.bridgeId, t.deviceKey),
  })
);

// ─────────────────────────────────────────────────────────────
// events — события движения (Этап 3). Открытое событие = endedAt IS NULL.
// Питает таймлайн в ЛК (клик по событию → воспроизведение сегмента архива).
// ─────────────────────────────────────────────────────────────
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cameraId: uuid("camera_id").notNull().references(() => cameras.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), // денорм. для запросов ЛК
    kind: text("kind").notNull().default("motion"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }), // NULL = ещё идёт
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCamera: index("events_camera_idx").on(t.cameraId, t.startedAt),
    byUser: index("events_user_idx").on(t.userId),
  })
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
