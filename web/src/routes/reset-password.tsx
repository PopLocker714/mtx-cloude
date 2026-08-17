import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LockKeyhole, Check } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { stubResetPassword } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({ email: typeof s.email === "string" ? s.email : "" }),
  component: ResetPassword,
});

function ResetPassword() {
  const [locale] = useAppLocale();
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
      await stubResetPassword(email, code, password);
      setDone(true);
      setTimeout(() => navigate({ to: "/login" }), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={m.rp_title({}, { locale })}
      subtitle={email ? m.rp_desc_email({ email }, { locale }) : m.rp_desc({}, { locale })}
      footer={
        <Link to="/login" className="hover:text-foreground">
          {m.fp_back({}, { locale })}
        </Link>
      }
    >
      <div className="space-y-6">
        {done ? (
          <div className="flex items-center gap-3 rounded-2xl bg-accent p-5 text-accent-foreground">
            <Check className="size-5 shrink-0" />
            <p className="text-sm">{m.rp_done({}, { locale })}</p>
          </div>
        ) : (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <LockKeyhole className="size-6" />
            </div>

            <form onSubmit={submit} className="space-y-5">
              <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <div className="space-y-2">
                <Label htmlFor="pw">{m.rp_new({}, { locale })}</Label>
                <Input
                  id="pw"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={loading || code.length < 6}>
                {loading ? "…" : m.rp_submit({}, { locale })}
              </Button>
            </form>
          </>
        )}

        <p className="rounded-2xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
          {m.fp_stub({}, { locale })}
        </p>
      </div>
    </AuthShell>
  );
}
