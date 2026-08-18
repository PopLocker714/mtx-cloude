import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "./db";
import { sendOtp, type Delivery } from "./email";

// Одноразовые коды подтверждения (email verification, сброс пароля).
//
// Пока не подключён почтовый провайдер, код доставляется через лог бэкенда
// (email.ts → console.log). Сам код при этом НАСТОЯЩИЙ: генерируется CSPRNG,
// живёт 15 минут, одноразовый, с лимитом попыток. То есть выключение стаба
// сведётся к реальной отправке письма, а не к переписыванию проверки.
//
// Хранилище — таблица verification Better Auth (identifier/value/expiresAt),
// поэтому миграция не нужна. identifier = "otp:<purpose>:<email>",
// value = "<sha256 кода>:<число попыток>" — сам код в базе не лежит.

export type OtpPurpose = "verify-email" | "reset-password";

const TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

const identifierFor = (purpose: OtpPurpose, email: string) => `otp:${purpose}:${email.toLowerCase()}`;
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

/** Ровно 6 цифр, равномерно (randomInt, не Math.random). */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Выдаёт новый код и «отправляет» его (сейчас — в лог).
 * Предыдущий код для той же пары purpose+email аннулируется.
 */
export async function issueOtp(purpose: OtpPurpose, email: string): Promise<Delivery> {
  const identifier = identifierFor(purpose, email);
  const code = generateCode();

  await db.delete(schema.verification).where(eq(schema.verification.identifier, identifier));
  await db.insert(schema.verification).values({
    id: crypto.randomUUID(),
    identifier,
    value: `${hashCode(code)}:0`,
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  return await sendOtp(email, code, purpose);
}

export type OtpCheck = { ok: true } | { ok: false; reason: "expired" | "invalid" | "too-many" };

/**
 * Проверяет код. Успех — код сразу сгорает; промах — счётчик попыток растёт,
 * после MAX_ATTEMPTS запись удаляется и нужен новый код.
 */
export async function consumeOtp(purpose: OtpPurpose, email: string, code: string): Promise<OtpCheck> {
  const identifier = identifierFor(purpose, email);
  const [row] = await db
    .select()
    .from(schema.verification)
    .where(eq(schema.verification.identifier, identifier))
    .limit(1);

  if (!row) return { ok: false, reason: "expired" };
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.verification).where(eq(schema.verification.id, row.id));
    return { ok: false, reason: "expired" };
  }

  const [storedHash, attemptsRaw] = row.value.split(":");
  const attempts = Number(attemptsRaw ?? 0);
  if (attempts >= MAX_ATTEMPTS) {
    await db.delete(schema.verification).where(eq(schema.verification.id, row.id));
    return { ok: false, reason: "too-many" };
  }

  // timingSafeEqual требует равной длины — hex-хэши всегда одинаковой.
  const given = Buffer.from(hashCode(String(code ?? "")), "hex");
  const stored = Buffer.from(storedHash ?? "", "hex");
  const match = given.length === stored.length && timingSafeEqual(given, stored);

  if (!match) {
    await db
      .update(schema.verification)
      .set({ value: `${storedHash}:${attempts + 1}`, updatedAt: new Date() })
      .where(eq(schema.verification.id, row.id));
    return { ok: false, reason: "invalid" };
  }

  await db.delete(schema.verification).where(eq(schema.verification.id, row.id));
  return { ok: true };
}

/** Уборка протухших кодов — вызывается на старте, чтобы таблица не пухла. */
export async function purgeExpiredOtp(): Promise<void> {
  await db
    .delete(schema.verification)
    .where(and(lt(schema.verification.expiresAt, new Date())));
}
