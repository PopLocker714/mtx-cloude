// Telegram-уведомления о движении (Этап 3). Graceful no-op без TELEGRAM_BOT_TOKEN
// (как email-заготовка): механизм готов, реального бота подключаем на деплое.
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "oko_cloud_bot";

export const telegramConfigured = () => !!TOKEN;

// Deep-link для привязки: юзер жмёт, бот получает /start <code> в webhook.
export const telegramLink = (code: string) => `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(code)}`;

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!TOKEN) {
    console.log("[telegram] нет токена — пропускаю отправку:", text.slice(0, 60));
    return false;
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.error("[telegram] sendMessage HTTP", r.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] send failed:", (e as Error).message);
    return false;
  } finally {
    clearTimeout(t);
  }
}
