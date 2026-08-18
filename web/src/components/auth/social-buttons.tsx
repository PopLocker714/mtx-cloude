import { useState } from "react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { authClient } from "@/lib/auth-client";
import { useAuthConfig } from "@/lib/auth-config";
import { Button } from "@/components/ui/button";

// Кнопки входа через соцсети.
//
// Набор фиксирован — Google, Apple, Telegram — и рисуется ВСЕГДА, чтобы вход не
// перестраивался, когда появятся ключи. Активной становится та кнопка, про которую
// бэкенд сказал «провайдер настроен» (GET /api/auth-providers); остальные disabled
// с подписью «скоро». Telegram живёт не на OAuth, а на Login Widget, поэтому в
// список от better-auth он не попадёт, пока не появится отдельный маршрут.

type ProviderId = "google" | "apple" | "telegram";

/** Официальный четырёхцветный глиф Google. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor" aria-hidden>
      <path d="M16.36 12.78c.02 2.63 2.31 3.5 2.34 3.52-.02.06-.36 1.25-1.2 2.47-.72 1.06-1.48 2.11-2.67 2.13-1.17.02-1.55-.69-2.88-.69-1.34 0-1.75.67-2.86.71-1.15.04-2.02-1.14-2.75-2.19-1.49-2.16-2.63-6.1-1.1-8.76.76-1.32 2.12-2.16 3.59-2.18 1.13-.02 2.19.76 2.88.76.69 0 1.98-.94 3.34-.8.57.02 2.17.23 3.19 1.73-.08.05-1.91 1.12-1.88 3.3zM14.2 4.9c.61-.74 1.02-1.77.91-2.8-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.22z" />
    </svg>
  );
}

/** Фирменный бумажный самолётик Telegram. */
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#2AABEE" />
      <path
        fill="#fff"
        d="M5.5 11.7c3.6-1.6 6-2.6 7.2-3.1 3.4-1.4 4.1-1.7 4.6-1.7.1 0 .3 0 .5.15.1.1.15.25.15.35 0 .1 0 .3-.02.45-.2 1.9-.9 6.6-1.3 8.7-.16.9-.47 1.2-.78 1.23-.66.06-1.16-.44-1.8-.86-1-.66-1.57-1.07-2.55-1.7-1.13-.75-.4-1.16.25-1.83.17-.18 3.1-2.84 3.15-3.08.01-.03.01-.14-.05-.2-.07-.06-.17-.04-.24-.02-.1.02-1.72 1.1-4.86 3.2-.46.32-.88.47-1.25.46-.41-.01-1.2-.23-1.79-.42-.72-.24-1.29-.36-1.24-.77.02-.21.31-.42.87-.64z"
      />
    </svg>
  );
}

const PROVIDERS: { id: ProviderId; label: string; icon: () => React.ReactElement }[] = [
  { id: "google", label: "Google", icon: GoogleIcon },
  { id: "apple", label: "Apple", icon: AppleIcon },
  { id: "telegram", label: "Telegram", icon: TelegramIcon },
];

export function SocialAuthButtons({ callbackURL = "/home" }: { callbackURL?: string }) {
  const [locale] = useAppLocale();
  const { providers } = useAuthConfig();
  const [busy, setBusy] = useState<string | null>(null);

  const available = providers.filter((p): p is ProviderId => PROVIDERS.some((x) => x.id === p));
  const anyLive = available.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map(({ id, label, icon: Icon }) => {
          const live = available.includes(id);
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="lg"
              // Неактивная кнопка не должна выглядеть сломанной: приглушаем целиком,
              // но иконку оставляем узнаваемой, иначе ряд читается как три заглушки.
              className="w-full justify-center gap-2 px-2 disabled:opacity-60"
              disabled={!live || busy !== null}
              aria-label={live ? `${label}` : `${label} — ${m.auth_social_soon({}, { locale })}`}
              title={live ? undefined : m.auth_social_soon({}, { locale })}
              onClick={() => {
                if (!live) return;
                setBusy(id);
                authClient
                  .signIn.social({ provider: id as "google" | "apple", callbackURL })
                  .catch(() => setBusy(null));
              }}
            >
              <Icon />
              <span className="truncate text-sm">{label}</span>
            </Button>
          );
        })}
      </div>

      {!anyLive && (
        <p className="text-center text-xs text-muted-foreground">
          {m.auth_social_hint({}, { locale })}
        </p>
      )}

      {/* Разделитель ПОД кнопками: соцвход — быстрый путь, форма ниже — запасной. */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {m.auth_or({}, { locale })}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
