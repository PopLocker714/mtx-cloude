import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db, schema } from "./db";

// Секрет обязателен и не короче 32 символов — иначе fail-closed (C-1 из аудита).
// Никаких дефолтных секретов в коде: забытая переменная не должна открывать форжинг сессий.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be set and be >= 32 chars (openssl rand -hex 32)");
}

// Кука — host-only на API-домене (без атрибута Domain). Клиент всегда ходит на api.<домен>,
// поэтому SameSite=None; Secure достаточно для работы между app. и api. — а Domain-атрибут
// на общих tunnel-доменах (Public Suffix List) браузер отвергает. Так что crossSubDomainCookies НЕ используем.
const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: process.env.BASE_URL || "http://localhost:9998",
  secret,
  trustedOrigins: (process.env.TRUSTED_ORIGINS || "http://localhost:9998,http://localhost:5173").split(","),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  // Rate-limit по IP (за Traefik IP берём из X-Forwarded-For). NO_RATE_LIMIT=1 отключает (для локальных тестов).
  rateLimit: { enabled: process.env.NO_RATE_LIMIT !== "1", window: 60, max: 30 },
  // Admin-плагин: управляет ролями (role), даёт setRole/listUsers/ban из UI.
  // role/banned/banReason/banExpires — поля плагина (в schema.ts).
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  user: {
    additionalFields: {
      // Факт принятия условий — ставится сервером при регистрации, клиент задать не может.
      termsAcceptedAt: { type: "date", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Регистрация = принятие пользовательского соглашения/политики. Фиксируем момент.
        before: async (user) => ({ data: { ...user, termsAcceptedAt: new Date() } }),
      },
    },
  },
  advanced: {
    // Свой префикс куки: на localhost у разработчика живут ДРУГИЕ Better Auth
    // проекты с дефолтным именем better-auth.session_token, и их Secure-куку
    // нельзя перезаписать нашей не-Secure (Strict Secure Cookies) — логин
    // молча не работает. oko.session_token ни с кем не конфликтует.
    // ВНИМАНИЕ: смена имени куки разлогинивает существующие сессии один раз.
    cookiePrefix: "oko",
    // За реверс-прокси (Traefik) реальный IP клиента — в X-Forwarded-For. Нужно для корректного
    // per-IP rate-limit (иначе Better Auth валит всех в одно общее ведро).
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    // host-only кука + SameSite=None; Secure в проде (кросс-сайт app.→api. без Domain-атрибута).
    defaultCookieAttributes: isProd
      ? { sameSite: "none", secure: true, httpOnly: true }
      : { sameSite: "lax", httpOnly: true },
  },
});
