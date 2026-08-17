import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { KeyRound, Send, Check, Palette, Monitor, Moon, Sun } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { DEFAULT_SEED, SEED_PRESETS, loadSeed, saveSeed } from "@/lib/m3-theme";
import { authClient, useSession } from "@/lib/auth-client";
import { getTelegramLink, unlinkTelegram, type TelegramStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

// Привязка Telegram для уведомлений о движении (Этап 3).
function TelegramCard() {
  const [locale] = useAppLocale();
  const [st, setSt] = useState<TelegramStatus | null>(null);

  function load() {
    getTelegramLink()
      .then(setSt)
      .catch(() => setSt(null));
  }
  useEffect(load, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4" /> {m.prof_tg_title({}, { locale })}
        </CardTitle>
        <CardDescription>{m.prof_tg_desc({}, { locale })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {st === null ? (
          <p className="text-sm text-muted-foreground">{m.app_loading({}, { locale })}</p>
        ) : st.linked ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-primary">
              <Check className="size-4" /> {m.prof_tg_linked({}, { locale })}
            </p>
            <Button variant="outline" size="sm" onClick={() => unlinkTelegram().then(load)}>
              {m.prof_tg_unlink({}, { locale })}
            </Button>
          </div>
        ) : !st.configured ? (
          <p className="text-sm text-muted-foreground">{m.prof_tg_not_configured({}, { locale })}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{m.prof_tg_hint({}, { locale })}</p>
            <Button asChild size="sm">
              <a href={st.url} target="_blank" rel="noreferrer">
                <Send className="size-4" /> {m.prof_tg_connect({}, { locale })}
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={load} className="ml-2">
              {m.prof_tg_check({}, { locale })}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Оформление: тема (светлая/тёмная/системная) и динамический цвет M3 —
// seed-цвет пересчитывается в полную схему на лету (см. lib/m3-theme.ts).
function AppearanceCard() {
  const [locale] = useAppLocale();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  useEffect(() => {
    setMounted(true);
    setSeed(loadSeed());
  }, []);

  const pick = (hex: string | null) => {
    saveSeed(hex);
    setSeed(hex);
  };

  const modes = [
    { key: "light", label: m.prof_theme_light({}, { locale }), icon: Sun },
    { key: "dark", label: m.prof_theme_dark({}, { locale }), icon: Moon },
    { key: "system", label: m.prof_theme_system({}, { locale }), icon: Monitor },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4" /> {m.prof_appearance({}, { locale })}
        </CardTitle>
        <CardDescription>{m.prof_appearance_desc({}, { locale })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{m.prof_theme({}, { locale })}</Label>
          <div className="flex gap-2">
            {modes.map((mo) => (
              <Button
                key={mo.key}
                type="button"
                size="sm"
                variant={mounted && theme === mo.key ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setTheme(mo.key)}
              >
                <mo.icon className="size-4" /> {mo.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>{m.prof_color({}, { locale })}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {SEED_PRESETS.map((p) => {
              const active = (seed ?? DEFAULT_SEED) === p.hex;
              return (
                <button
                  key={p.hex}
                  type="button"
                  title={p.name}
                  aria-label={p.name}
                  onClick={() => pick(p.hex === DEFAULT_SEED ? null : p.hex)}
                  className={`size-8 rounded-full ring-offset-2 ring-offset-background transition-shadow ${active ? "ring-2 ring-ring" : "hover:ring-2 hover:ring-border"}`}
                  style={{ backgroundColor: p.hex }}
                />
              );
            })}
            <label
              className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border text-muted-foreground"
              title={m.prof_color_custom({}, { locale })}
            >
              <input
                type="color"
                className="absolute size-0 opacity-0"
                value={seed ?? DEFAULT_SEED}
                onChange={(e) => pick(e.target.value)}
              />
              +
            </label>
            {seed && (
              <Button type="button" variant="ghost" size="sm" onClick={() => pick(null)}>
                {m.prof_color_reset({}, { locale })}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfilePage() {
  const [locale] = useAppLocale();
  const { data: session } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (next !== confirm) return setError(m.prof_pw_mismatch({}, { locale }));
    if (next.length < 8) return setError(m.login_password_short({}, { locale }));
    setLoading(true);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setLoading(false);
    if (res.error) return setError(res.error.message || m.prof_pw_failed({}, { locale }));
    setOk(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-semibold">{m.prof_title({}, { locale })}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.prof_account({}, { locale })}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">{m.prof_email({}, { locale })}</span> {session?.user?.email}</div>
          <div><span className="text-muted-foreground">{m.prof_name({}, { locale })}</span> {session?.user?.name || "—"}</div>
        </CardContent>
      </Card>

      <AppearanceCard />

      <TelegramCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> {m.prof_pw_title({}, { locale })}
          </CardTitle>
          <CardDescription>{m.prof_pw_desc({}, { locale })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">{m.prof_pw_current({}, { locale })}</Label>
              <Input id="cur" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">{m.prof_pw_new({}, { locale })}</Label>
              <Input id="new" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf">{m.prof_pw_repeat({}, { locale })}</Label>
              <Input id="conf" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {ok && <p className="text-sm text-primary">{m.prof_pw_changed({}, { locale })}</p>}
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "…" : m.prof_pw_submit({}, { locale })}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
