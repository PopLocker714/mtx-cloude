// Отправка писем через Resend (решение Ильи 2026-08-18).
//
// Включается наличием RESEND_API_KEY. Без ключа ничего не отправляется, а код
// подтверждения печатается в лог бэкенда (docker compose logs -f backend) —
// так флоу можно проходить руками до подключения домена.
//
// Отправитель: RESEND_FROM, например "oko <no-reply@oko-cloud.com>". Домен нужно
// верифицировать в Resend (DNS-записи), иначе письма уйдут только на адрес владельца
// аккаунта с дефолтного onboarding@resend.dev.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const apiKey = () => process.env.RESEND_API_KEY?.trim() || "";
const from = () => process.env.RESEND_FROM?.trim() || "oko <onboarding@resend.dev>";

/** Настроен ли реальный транспорт. Пусто → работаем в лог. */
export function emailEnabled(): boolean {
  return apiKey().length > 0;
}

export type Delivery = "log" | "email" | "failed";

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<Delivery> {
  const key = apiKey();
  if (!key) {
    console.log(`[email-log] → ${to} | ${subject} | ${text}`);
    return "log";
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: from(), to: [to], subject, text, ...(html ? { html } : {}) }),
    });

    if (!res.ok) {
      // Тело ответа Resend содержит понятную причину (невериф. домен, битый from) —
      // логируем её, но не роняем запрос пользователя: код всё равно создан.
      const body = await res.text().catch(() => "");
      console.error(`[resend] ${res.status} ${res.statusText} → ${to}: ${body.slice(0, 400)}`);
      return "failed";
    }

    const { id } = (await res.json().catch(() => ({}))) as { id?: string };
    console.log(`[resend] отправлено → ${to} (id ${id ?? "?"})`);
    return "email";
  } catch (err) {
    console.error(`[resend] сеть недоступна → ${to}:`, err);
    return "failed";
  }
}

/**
 * Код подтверждения. Пока транспорт не настроен — печатаем заметным блоком,
 * чтобы код можно было выхватить глазами из потока логов и ввести в форму.
 */
export async function sendOtp(to: string, code: string, purpose?: string): Promise<Delivery> {
  const what = purpose === "reset-password" ? "сброс пароля" : "подтверждение почты";

  if (!emailEnabled()) {
    console.log(
      [
        "",
        "  ╔══════════════════════════════════════════╗",
        `  ║  КОД ${what.toUpperCase().padEnd(22)}       ║`,
        `  ║  ${to.slice(0, 34).padEnd(34)}          ║`,
        "  ║                                          ║",
        `  ║             >>>  ${code}  <<<            ║`,
        "  ║          действует 15 минут              ║",
        "  ╚══════════════════════════════════════════╝",
        "",
      ].join("\n")
    );
  }

  const subject = purpose === "reset-password" ? "Сброс пароля oko-cloud" : "Код подтверждения oko-cloud";
  return await sendEmail(
    to,
    subject,
    `Ваш код (${what}): ${code}. Действует 15 минут. Если это были не вы — просто игнорируйте письмо.`,
    otpHtml(code, what)
  );
}

function otpHtml(code: string, what: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:440px;background:#fff;border-radius:20px;padding:32px">
        <tr><td style="font-size:18px;font-weight:600;color:#12241a;padding-bottom:8px">oko</td></tr>
        <tr><td style="font-size:15px;color:#4a5a51;padding-bottom:24px">Код на ${what}</td></tr>
        <tr><td align="center" style="font-size:34px;letter-spacing:8px;font-weight:700;color:#12241a;background:#e8f5ed;border-radius:14px;padding:18px 0">${code}</td></tr>
        <tr><td style="font-size:13px;color:#7b8a82;padding-top:20px">Код действует 15 минут. Если это были не вы — просто игнорируйте письмо.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
