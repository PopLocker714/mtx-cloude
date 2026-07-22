import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { stubResetPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({ email: typeof s.email === "string" ? s.email : "" }),
  component: ResetPassword,
});

function ResetPassword() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await stubResetPassword(email, code, password); // любой код (стаб)
      setDone(true);
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Новый пароль</CardTitle>
          <CardDescription>
            {email ? <>Введите код из письма для <b>{email}</b> и новый пароль.</> : "Введите код и новый пароль."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-sm text-center py-4">Пароль изменён. Перенаправляем ко входу…</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Новый пароль</Label>
                <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
                {loading ? "…" : "Сменить пароль"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Заготовка: реальный сброс подключим через Unisender Go. Сейчас подходит любой код.
          </p>
          <p className="mt-2 text-sm text-center">
            <Link to="/login" className="underline">← Ко входу</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
