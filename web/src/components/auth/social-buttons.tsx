import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { authClient } from "@/lib/auth-client";
import { API_BASE } from "@/lib/api-base";
import { Button } from "@/components/ui/button";

// Кнопки входа через соцсети.
//
// База на вырост: провайдер описывается ОДНОЙ записью в PROVIDERS (лейбл +
// фирменная иконка), а показывается только если бэкенд сообщил, что ключи для
// него настроены (GET /api/auth-providers). Поэтому добавить, скажем, Apple —
// это блок в backend/src/auth.ts плюс запись здесь; трогать разметку не нужно.
// Если не настроен ни один провайдер, блок не рендерится совсем.

type ProviderId = "google" | "apple" | "github" | "facebook";

/** Официальный четырёхцветный глиф Google. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
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
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M16.36 12.78c.02 2.63 2.31 3.5 2.34 3.52-.02.06-.36 1.25-1.2 2.47-.72 1.06-1.48 2.11-2.67 2.13-1.17.02-1.55-.69-2.88-.69-1.34 0-1.75.67-2.86.71-1.15.04-2.02-1.14-2.75-2.19-1.49-2.16-2.63-6.1-1.1-8.76.76-1.32 2.12-2.16 3.59-2.18 1.13-.02 2.19.76 2.88.76.69 0 1.98-.94 3.34-.8.57.02 2.17.23 3.19 1.73-.08.05-1.91 1.12-1.88 3.3zM14.2 4.9c.61-.74 1.02-1.77.91-2.8-.88.04-1.94.59-2.57 1.32-.56.65-1.05 1.7-.92 2.7.98.08 1.98-.5 2.58-1.22z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="#1877F2" aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}

const PROVIDERS: Record<ProviderId, { label: string; icon: () => React.ReactElement }> = {
  google: { label: "Google", icon: GoogleIcon },
  apple: { label: "Apple", icon: AppleIcon },
  github: { label: "GitHub", icon: GithubIcon },
  facebook: { label: "Facebook", icon: FacebookIcon },
};

export function SocialAuthButtons({ callbackURL = "/home" }: { callbackURL?: string }) {
  const [locale] = useAppLocale();
  const [available, setAvailable] = useState<ProviderId[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth-providers`)
      .then((r) => r.json())
      .then((d: { providers?: string[] }) =>
        setAvailable(((d.providers ?? []) as ProviderId[]).filter((p) => p in PROVIDERS))
      )
      .catch(() => setAvailable([]));
  }, []);

  // null — ещё не знаем; пустой список — провайдеров нет, блок не нужен.
  if (!available || available.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className={available.length > 1 ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
        {available.map((id) => {
          const p = PROVIDERS[id];
          const Icon = p.icon;
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              size="lg"
              className="w-full justify-center gap-2"
              disabled={busy !== null}
              onClick={() => {
                setBusy(id);
                authClient.signIn.social({ provider: id, callbackURL }).catch(() => setBusy(null));
              }}
            >
              <Icon />
              {available.length > 1 ? p.label : m.auth_continue_with({ provider: p.label }, { locale })}
            </Button>
          );
        })}
      </div>
      {/* Разделитель ПОД кнопками: соцвход — быстрый путь, форма ниже — запасной. */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {m.auth_or({}, { locale })}
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
