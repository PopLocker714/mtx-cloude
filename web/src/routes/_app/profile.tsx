import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { KeyRound, Send, Check, Palette, Monitor, Moon, Sun } from "lucide-react";
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
          <Send className="size-4" /> Telegram-уведомления
        </CardTitle>
        <CardDescription>Алерты о движении на камерах приходят в Telegram.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {st === null ? (
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        ) : st.linked ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-green-600">
              <Check className="size-4" /> Telegram подключён.
            </p>
            <Button variant="outline" size="sm" onClick={() => unlinkTelegram().then(load)}>
              Отвязать
            </Button>
          </div>
        ) : !st.configured ? (
          <p className="text-sm text-muted-foreground">
            Бот ещё не настроен на сервере. Уведомления заработают после подключения бота администратором.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Нажмите кнопку, затем <b>Start</b> в открывшемся чате с ботом — аккаунт привяжется автоматически.
            </p>
            <Button asChild size="sm">
              <a href={st.url} target="_blank" rel="noreferrer">
                <Send className="size-4" /> Подключить Telegram
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={load} className="ml-2">
              Я нажал Start — проверить
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
    { key: "light", label: "Светлая", icon: Sun },
    { key: "dark", label: "Тёмная", icon: Moon },
    { key: "system", label: "Системная", icon: Monitor },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4" /> Оформление
        </CardTitle>
        <CardDescription>Тема и цвет кабинета. Цвет пересчитывается по Material Design 3.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Тема</Label>
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
          <Label>Цвет</Label>
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
              title="Свой цвет"
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
                Сбросить
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfilePage() {
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
    if (next !== confirm) return setError("Пароли не совпадают.");
    if (next.length < 8) return setError("Пароль должен быть не короче 8 символов.");
    setLoading(true);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setLoading(false);
    if (res.error) return setError(res.error.message || "Не удалось сменить пароль");
    setOk(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-semibold">Профиль</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Аккаунт</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Email:</span> {session?.user?.email}</div>
          <div><span className="text-muted-foreground">Имя:</span> {session?.user?.name || "—"}</div>
        </CardContent>
      </Card>

      <AppearanceCard />

      <TelegramCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" /> Смена пароля</CardTitle>
          <CardDescription>Текущий пароль подтверждает, что это вы.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cur">Текущий пароль</Label>
              <Input id="cur" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">Новый пароль</Label>
              <Input id="new" type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conf">Повторите новый пароль</Label>
              <Input id="conf" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {ok && <p className="text-sm text-green-600">Пароль изменён.</p>}
            <Button type="submit" disabled={loading}>{loading ? "…" : "Сменить пароль"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
