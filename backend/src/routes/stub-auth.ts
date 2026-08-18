import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db";
import { auth } from "../auth";
import { issueOtp, consumeOtp, type OtpPurpose } from "../otp";
import { emailEnabled } from "../email";

// Флоу подтверждения email и сброса пароля по одноразовому коду.
//
// Коды НАСТОЯЩИЕ (otp.ts: CSPRNG, TTL 15 мин, одноразовые, лимит попыток).
// Доставка зависит от Resend: есть RESEND_API_KEY — код уходит письмом, нет —
// печатается в лог бэкенда (docker compose logs -f backend).
//
// Сброс пароля работает, когда код действительно уходит письмом. Пока доставки
// нет, он открывается только флагом STUB_AUTH вне production: код виден в логах,
// и любой, у кого есть доступ к логам, иначе сменил бы чужой пароль.
export const stubAuth = new Hono();

// Жёсткая защита (H2): демо-сброс пароля НИКОГДА не работает в проде, даже если STUB_AUTH=1
// случайно оставили включённым после демонстрации. В проде путь один — настоящее письмо.
const STUB_ENABLED = process.env.STUB_AUTH === "1" && process.env.NODE_ENV !== "production";
/** Сброс пароля разрешён, когда код уходит письмом, либо в демо-режиме вне прода. */
const resetAllowed = () => emailEnabled() || STUB_ENABLED;
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
  const delivery = await issueOtp(p, email);
  return c.json({ ok: true, delivery });
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

// Сброс пароля — код проверяется всегда; доступен при настроенной почте,
// либо вне прода под STUB_AUTH=1, пока код доставляется логом.
stubAuth.post("/reset-password", async (c) => {
  if (!resetAllowed()) {
    return c.json({ error: "Сброс пароля недоступен: почта не настроена (RESEND_API_KEY). Для демо вне прода — STUB_AUTH=1." }, 501);
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
