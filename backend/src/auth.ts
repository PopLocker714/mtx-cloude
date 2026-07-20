import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db";

// Секрет обязателен и не короче 32 символов — иначе fail-closed (C-1 из аудита).
// Никаких дефолтных секретов в коде: забытая переменная не должна открывать форжинг сессий.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be set and be >= 32 chars (openssl rand -hex 32)");
}

// Домен для кросс-сабдоменной куки (app. ↔ api.). Напр. ".tunnel.poploker.ru".
const cookieDomain = process.env.COOKIE_DOMAIN; // необязателен для локалки
const isProd = process.env.NODE_ENV === "production" || !!cookieDomain;

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
  // Rate-limit включён (защита логина/регистрации от перебора).
  rateLimit: { enabled: true, window: 60, max: 30 },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
  },
  advanced: {
    // Кука видна на всех поддоменах *.tunnel.poploker.ru; SameSite=None+Secure для кросс-сайта.
    ...(cookieDomain ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } } : {}),
    defaultCookieAttributes: isProd
      ? { sameSite: "none", secure: true, httpOnly: true }
      : { sameSite: "lax", httpOnly: true },
  },
});
