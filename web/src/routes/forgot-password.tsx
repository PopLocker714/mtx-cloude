import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { stubSendCode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await stubSendCode(email); // стаб — код не уходит
      navigate({ to: "/reset-password", search: { email } });
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Восстановление пароля</CardTitle>
          <CardDescription>Укажите email — пришлём код для сброса пароля.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "…" : "Отправить код"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Заготовка: письма пока не отправляются (подключим Unisender Go).
          </p>
          <p className="mt-2 text-sm text-center">
            <Link to="/login" className="underline">← Ко входу</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
