import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "./db";

// Better Auth — регистрация/логин/сессии. Мы поверх него держим доменную логику
// (камеры, токены просмотра, auth-hook). role — доп. поле, юзер его не задаёт.
export const auth = betterAuth({
  baseURL: process.env.BASE_URL || "http://localhost:9998",
  secret: process.env.BETTER_AUTH_SECRET || "dev-insecure-secret-change-me",
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
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
    },
  },
});
