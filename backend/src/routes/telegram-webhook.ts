import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { sendTelegram } from "../telegram";

// Публичный webhook Telegram (бот шлёт сюда апдейты). Привязка аккаунта по deep-link:
// пользователь жмёт t.me/<bot>?start=<code> → бот получает "/start <code>" → сохраняем chatId.
// Защита: секрет из setWebhook приходит в заголовке X-Telegram-Bot-Api-Secret-Token.
export const telegramWebhook = new Hono();
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

telegramWebhook.post("/", async (c) => {
  if (SECRET && c.req.header("x-telegram-bot-api-secret-token") !== SECRET) return c.body(null, 401);
  const update = (await c.req.json().catch(() => ({}))) as any;
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const m = typeof msg?.text === "string" ? /^\/start\s+(\S+)/.exec(msg.text) : null;
  if (chatId && m) {
    const code = m[1].slice(0, 64);
    const [u] = await db.select().from(schema.user).where(eq(schema.user.telegramLinkCode, code)).limit(1);
    if (u) {
      await db
        .update(schema.user)
        .set({ telegramChatId: String(chatId), telegramLinkCode: null })
        .where(eq(schema.user.id, u.id));
      await sendTelegram(String(chatId), "✅ Telegram привязан. Буду присылать уведомления о движении.");
    } else {
      await sendTelegram(String(chatId), "Код привязки не найден или устарел. Получите новую ссылку в разделе «Профиль».");
    }
  }
  return c.json({ ok: true }); // Telegram ждёт 200, иначе ретраит
});
