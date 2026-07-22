import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

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
