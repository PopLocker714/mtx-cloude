import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db";
import { auth } from "../auth";
import { sendOtp } from "../email";

// ЗАГОТОВКА флоу подтверждения email и сброса пароля по коду.
// Код НЕ проверяется (принимаем любой) — это стаб, пока не подключён Unisender Go + emailOTP.
// Сброс пароля закрыт флагом STUB_AUTH (по умолчанию выключен), чтобы не оставить на проде
// открытую смену пароля по email. UI-страницы показывают флоу в любом случае.
export const stubAuth = new Hono();

// Жёсткая защита (H2): демо-сброс пароля НИКОГДА не работает в проде, даже если STUB_AUTH=1
// случайно оставили включённым после демонстрации. В проде — только реальный флоу (Unisender Go).
const STUB_ENABLED = process.env.STUB_AUTH === "1" && process.env.NODE_ENV !== "production";
if (process.env.STUB_AUTH === "1" && process.env.NODE_ENV === "production") {
  console.warn("SECURITY: STUB_AUTH=1 проигнорирован в production — демо-сброс пароля отключён.");
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// «Отправить код» — сейчас no-op (лог). Документирует шаг отправки.
stubAuth.post("/send-code", async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return c.json({ error: "неверный email" }, 400);
  // Реального кода нет — на бэке любой код примется. Логируем «отправку».
  await sendOtp(email, "000000");
  return c.json({ ok: true, stub: true });
});

// Подтверждение email — ЛЮБОЙ код принимается, помечаем email verified. Низкий риск (verified нигде не гейтится).
stubAuth.post("/verify-email", async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return c.json({ error: "неверный email" }, 400);
  await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email));
  return c.json({ ok: true, stub: true });
});

// Сброс пароля — ЛЮБОЙ код. Опасно (unauth смена пароля по email), поэтому ТОЛЬКО при STUB_AUTH=1.
stubAuth.post("/reset-password", async (c) => {
  if (!STUB_ENABLED) {
    return c.json({ error: "Заготовка: сброс пароля будет через Unisender Go. Включается STUB_AUTH=1 для демо." }, 501);
  }
  const { email, newPassword } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return c.json({ error: "неверный email" }, 400);
  if (typeof newPassword !== "string" || newPassword.length < 8) return c.json({ error: "пароль ≥8 символов" }, 400);

  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (!u) return c.json({ ok: true, stub: true }); // не раскрываем существование email

  // Хэшируем родным хэшером Better Auth и обновляем credential-аккаунт.
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);
  await db
    .update(schema.account)
    .set({ password: hash })
    .where(and(eq(schema.account.userId, u.id), eq(schema.account.providerId, "credential")));
  return c.json({ ok: true, stub: true });
});
