import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { stubSendCode, stubVerifyEmail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({ email: typeof s.email === "string" ? s.email : "" }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email } = Route.useSearch();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // «Отправляем» код при заходе (стаб — реально не уходит).
  useEffect(() => {
    if (email) stubSendCode(email).then(() => setSent(true)).catch(() => {});
  }, [email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await stubVerifyEmail(email, code); // любой код принимается (стаб)
      window.location.href = "/cameras";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Подтверждение почты</CardTitle>
          <CardDescription>
            {email ? <>Код отправлен на <b>{email}</b>. Введите его ниже.</> : "Введите код из письма."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4 flex flex-col items-center">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
              {loading ? "…" : "Подтвердить"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Заготовка: письма пока не отправляются (подключим Unisender Go). Подойдёт любой код.
          </p>
          <p className="mt-2 text-sm text-center">
            <Link to="/login" className="underline">← Ко входу</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
