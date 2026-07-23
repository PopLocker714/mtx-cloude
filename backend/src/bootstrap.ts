import { eq, isNotNull, sql } from "drizzle-orm";
import { auth } from "./auth";
import { db, schema } from "./db";
import { bridgeKeyConfigured } from "./lib";

// Fail-closed: если в БД есть зашифрованные creds камер, но ключ не задан — падаем при старте.
export async function ensureBridgeKey(): Promise<void> {
  if (bridgeKeyConfigured()) return;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.cameras)
    .where(isNotNull(schema.cameras.sourceUrl));
  if (n > 0) {
    throw new Error(
      `BRIDGE_SECRET_KEY must be set (openssl rand -hex 32): ${n} camera(s) have encrypted source_url that cannot be decrypted without it`
    );
  }
}

// Гарантирует, что пользователь из ADMIN_EMAIL — админ. Запускается при старте.
// - юзер существует  → повышаем роль до admin;
// - не существует и задан ADMIN_PASSWORD → создаём через Better Auth (правильный хэш) и повышаем;
// - не существует и пароля нет → предупреждение (создать не из чего).
export async function ensureAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;

  try {
    const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
    if (existing) {
      if (existing.role !== "admin") {
        await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.id, existing.id));
        console.log(`bootstrap: promoted ${email} to admin`);
      } else {
        console.log(`bootstrap: ${email} is already admin`);
      }
      return;
    }

    const password = process.env.ADMIN_PASSWORD;
    if (!password || password.length < 8) {
      console.warn(`bootstrap: ADMIN_EMAIL=${email} not found and ADMIN_PASSWORD missing/short — admin NOT created`);
      return;
    }
    await auth.api.signUpEmail({ body: { email, password, name: "Administrator" } });
    await db.update(schema.user).set({ role: "admin" }).where(eq(schema.user.email, email));
    console.log(`bootstrap: created admin ${email}`);
  } catch (e) {
    // Бутстрап не должен ронять сервер.
    console.error("bootstrap: ensureAdmin failed:", (e as Error).message);
  }
}
