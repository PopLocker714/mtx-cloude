import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Send, Check } from "lucide-react";
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
