// ЗАГОТОВКА отправки писем. Провайдер будет Unisender Go (НЕ Resend), но СЕЙЧАС не подключаем —
// письмо никуда не уходит, код печатается в лог бэкенда (docker compose logs -f backend).
// Когда придёт время: реализовать sendEmail через Unisender Go transactional API
//   POST https://go1.unisender.ru/ru/transactional/api/v1/email/send.json  (X-API-KEY: UNISENDER_GO_API_KEY)
// и удалить баннер кода из логов — сами коды к тому моменту уже настоящие (см. otp.ts).

export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  // TODO(unisender-go): реальная отправка. Пока — no-op с логом.
  console.log(`[email-stub] → ${to} | ${subject} | ${text}`);
}

/**
 * Код подтверждения. Пока писем нет — печатаем заметным блоком, чтобы код
 * можно было выхватить глазами из потока логов и ввести в форму.
 */
export async function sendOtp(to: string, code: string, purpose?: string): Promise<void> {
  const what = purpose === "reset-password" ? "сброс пароля" : "подтверждение почты";
  console.log(
    [
      "",
      "  ╔══════════════════════════════════════════╗",
      `  ║  КОД ${what.toUpperCase().padEnd(22)}       ║`,
      `  ║  ${to.slice(0, 34).padEnd(34)}          ║`,
      `  ║                                          ║`,
      `  ║             >>>  ${code}  <<<            ║`,
      `  ║          действует 15 минут              ║`,
      "  ╚══════════════════════════════════════════╝",
      "",
    ].join("\n")
  );
  await sendEmail(to, "Код подтверждения oko-cloud", `Ваш код подтверждения: ${code}`);
}
