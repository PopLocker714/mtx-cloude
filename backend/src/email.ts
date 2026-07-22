// ЗАГОТОВКА отправки писем. Провайдер будет Unisender Go (НЕ Resend), но СЕЙЧАС не подключаем —
// ничего реально не отправляется, только лог. Стаб-верификация принимает любой код.
// Когда придёт время: реализовать sendEmail через Unisender Go transactional API
//   POST https://go1.unisender.ru/ru/transactional/api/v1/email/send.json  (X-API-KEY: UNISENDER_GO_API_KEY)
// и переключить стаб-эндпоинты на реальный emailOTP-плагин Better Auth.

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  // TODO(unisender-go): реальная отправка. Пока — no-op с логом.
  console.log(`[email-stub] → ${to} | ${subject} | ${text}`);
}

export async function sendOtp(to: string, code: string): Promise<void> {
  await sendEmail(to, "Код подтверждения oko-cloud", `Ваш код подтверждения: ${code}`);
}
