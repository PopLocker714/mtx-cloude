import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api-base";

// Что бэкенд умеет прямо сейчас: какие соцвходы настроены и уходят ли письма.
// Один запрос на оба факта — фронт не должен ни рисовать живую кнопку без ключей,
// ни обещать письмо, когда код печатается в лог.

export type AuthConfig = { providers: string[]; email: boolean };

const EMPTY: AuthConfig = { providers: [], email: false };

export function useAuthConfig(): AuthConfig {
  const [cfg, setCfg] = useState<AuthConfig>(EMPTY);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/auth-providers`)
      .then((r) => r.json())
      .then((d: Partial<AuthConfig>) => {
        if (alive) setCfg({ providers: d.providers ?? [], email: d.email === true });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return cfg;
}
