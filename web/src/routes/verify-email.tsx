import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { stubSendCode, stubVerifyEmail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({ email: typeof s.email === "string" ? s.email : "" }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const [locale] = useAppLocale();
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
      await stubVerifyEmail(email, code);
      window.location.href = "/home";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{m.ve_title({}, { locale })}</CardTitle>
          <CardDescription>
            {email ? m.ve_desc_sent({ email }, { locale }) : m.ve_desc({}, { locale })}
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
              {loading ? "…" : m.ve_submit({}, { locale })}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">{m.fp_stub({}, { locale })}</p>
          <p className="mt-2 text-sm text-center">
            <Link to="/login" className="underline">{m.fp_back({}, { locale })}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
