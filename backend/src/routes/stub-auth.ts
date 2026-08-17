import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db";
import { auth } from "../auth";
import { issueOtp, consumeOtp, type OtpPurpose } from "../otp";

// Флоу подтверждения email и сброса пароля по одноразовому коду.
//
// Коды НАСТОЯЩИЕ (otp.ts: CSPRNG, TTL 15 мин, одноразовые, лимит попыток) —
// стаб только в доставке: письма пока не отправляются, код печатается в лог
// бэкенда. Подключение Unisender Go = заменить sendEmail, проверку не трогать.
//
// Сброс пароля дополнительно закрыт флагом STUB_AUTH и никогда не работает
// в production: пока код виден в логах, любой, у кого есть доступ к логам,
// смог бы сменить чужой пароль.
export const stubAuth = new Hono();

// Жёсткая защита (H2): демо-сброс пароля НИКОГДА не работает в проде, даже если STUB_AUTH=1
// случайно оставили включённым после демонстрации. В проде — только реальный флоу (Unisender Go).
const STUB_ENABLED = process.env.STUB_AUTH === "1" && process.env.NODE_ENV !== "production";
if (process.env.STUB_AUTH === "1" && process.env.NODE_ENV === "production") {
  console.warn("SECURITY: STUB_AUTH=1 проигнорирован в production — демо-сброс пароля отключён.");
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_RE = /^\d{6}$/;

/** Ответ на неверный код — одинаковый по форме, чтобы не подсказывать перебору. */
function codeError(reason: "expired" | "invalid" | "too-many") {
  const msg =
    reason === "too-many"
      ? "Слишком много попыток. Запросите новый код."
      : reason === "expired"
        ? "Код истёк. Запросите новый."
        : "Неверный код.";
  return { error: msg, reason };
}

// Выдать код: генерируем, кладём в verification, печатаем в лог бэкенда.
// Существование email не раскрываем — ответ одинаковый в любом случае.
stubAuth.post("/send-code", async (c) => {
  const { email, purpose } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return c.json({ error: "неверный email" }, 400);
  const p: OtpPurpose = purpose === "reset-password" ? "reset-password" : "verify-email";
  await issueOtp(p, email);
  return c.json({ ok: true, delivery: "log" });
});

// Подтверждение email — код проверяется по-настоящему.
stubAuth.post("/verify-email", async (c) => {
  const { email, code } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return c.json({ error: "неверный email" }, 400);
  if (typeof code !== "string" || !CODE_RE.test(code)) return c.json({ error: "код — 6 цифр" }, 400);

  const res = await consumeOtp("verify-email", email, code);
  if (!res.ok) return c.json(codeError(res.reason), 400);

  await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.email, email));
  return c.json({ ok: true });
});

// Сброс пароля — код проверяется; доступно только вне прода при STUB_AUTH=1,
// пока код доставляется логом, а не письмом.
stubAuth.post("/reset-password", async (c) => {
  if (!STUB_ENABLED) {
    return c.json({ error: "Заготовка: сброс пароля будет через Unisender Go. Включается STUB_AUTH=1 для демо." }, 501);
  }
  const { email, code, newPassword } = await c.req.json().catch(() => ({}));
  if (typeof email !== "string" || !EMAIL_RE.test(email)) return c.json({ error: "неверный email" }, 400);
  if (typeof code !== "string" || !CODE_RE.test(code)) return c.json({ error: "код — 6 цифр" }, 400);
  if (typeof newPassword !== "string" || newPassword.length < 8) return c.json({ error: "пароль ≥8 символов" }, 400);

  const res = await consumeOtp("reset-password", email, code);
  if (!res.ok) return c.json(codeError(res.reason), 400);

  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email)).limit(1);
  if (!u) return c.json({ ok: true }); // не раскрываем существование email

  // Хэшируем родным хэшером Better Auth и обновляем credential-аккаунт.
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(newPassword);
  await db
    .update(schema.account)
    .set({ password: hash })
    .where(and(eq(schema.account.userId, u.id), eq(schema.account.providerId, "credential")));
  return c.json({ ok: true });
});
