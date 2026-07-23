// Идемпотентная миграция MVP: создаёт таблицы, если их нет.
// Better Auth core-таблицы (user/session/account/verification) + доменные.
// На проде позже перейдём на drizzle-kit generate + журнал миграций.
import { client } from "./index";

await client.unsafe(`
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Better Auth core ───
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_user_idx ON "session"(user_id);

CREATE TABLE IF NOT EXISTS "account" (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_idx ON "account"(user_id);

CREATE TABLE IF NOT EXISTS "verification" (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_ident_idx ON "verification"(identifier);

-- ─── Доменные таблицы oko-cloud ───
CREATE TABLE IF NOT EXISTS bridges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Bridge',
  pairing_code text UNIQUE,
  pairing_expires_at timestamptz,
  token text NOT NULL UNIQUE,
  paired_at timestamptz,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  bridge_id uuid REFERENCES bridges(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Камера',
  path text NOT NULL UNIQUE,
  publish_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cameras_user_idx ON cameras(user_id);

CREATE TABLE IF NOT EXISTS view_tokens (
  token text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  camera_id uuid REFERENCES cameras(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS view_tokens_expiry_idx ON view_tokens(expires_at);

CREATE TABLE IF NOT EXISTS view_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  camera_path text NOT NULL,
  action text NOT NULL,
  ip text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS view_audit_camera_idx ON view_audit(camera_path);

-- ─── Идемпотентные ALTER для существующих БД (эволюция схемы после первого деплоя) ───
ALTER TABLE "user"  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE "user"  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
-- Поля admin-плагина Better Auth
ALTER TABLE "user"  ADD COLUMN IF NOT EXISTS banned boolean DEFAULT false;
ALTER TABLE "user"  ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE "user"  ADD COLUMN IF NOT EXISTS ban_expires timestamptz;
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS pairing_expires_at timestamptz;
ALTER TABLE bridges ALTER COLUMN pairing_code DROP NOT NULL;
-- Bridge-агент: токен хэшируется, отзыв, телеметрия
ALTER TABLE bridges ALTER COLUMN token DROP NOT NULL;
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS token_hash    text;
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS token_prefix  text;
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS revoked_at    timestamptz;
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS agent_version text;
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS last_ip       text;
CREATE UNIQUE INDEX IF NOT EXISTS bridges_token_hash_idx ON bridges(token_hash);
-- Камеры: источник (RTSP камеры, зашифрован), desired-state, online-деривация
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS enabled    boolean NOT NULL DEFAULT true;
ALTER TABLE cameras ADD COLUMN IF NOT EXISTS last_seen  timestamptz;
CREATE INDEX IF NOT EXISTS cameras_bridge_idx ON cameras(bridge_id);
`);

console.log("migrate: ok");
await client.end();
