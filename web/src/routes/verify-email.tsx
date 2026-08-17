import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { stubSendCode, stubVerifyEmail } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
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
  const [resent, setResent] = useState(false);

  // Код выдаётся при заходе на страницу (доставка — лог бэкенда, пока нет писем).
  useEffect(() => {
    if (email) stubSendCode(email, "verify-email").catch(() => {});
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

  async function resend() {
    setError(null);
    setCode("");
    await stubSendCode(email, "verify-email").catch(() => {});
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  }

  return (
    <AuthShell
      title={m.ve_title({}, { locale })}
      subtitle={email ? m.ve_desc_sent({ email }, { locale }) : m.ve_desc({}, { locale })}
      footer={
        <Link to="/login" className="hover:text-foreground">
          {m.fp_back({}, { locale })}
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <MailCheck className="size-6" />
        </div>

        <form onSubmit={submit} className="space-y-5">
          <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-12 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={loading || code.length < 6}>
            {loading ? "…" : m.ve_submit({}, { locale })}
          </Button>
        </form>

        <button
          type="button"
          onClick={resend}
          className="whitespace-nowrap text-sm text-muted-foreground hover:text-foreground"
        >
          {resent ? m.ve_resent({}, { locale }) : m.ve_resend({}, { locale })}
        </button>

        <p className="rounded-2xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
          {m.fp_stub({}, { locale })}
        </p>
      </div>
    </AuthShell>
  );
}
