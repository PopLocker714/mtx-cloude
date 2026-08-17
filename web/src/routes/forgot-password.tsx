import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { stubSendCode } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await stubSendCode(email, "reset-password"); // письма нет — код уходит в лог бэкенда
      navigate({ to: "/reset-password", search: { email } });
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={m.fp_title({}, { locale })}
      subtitle={m.fp_desc({}, { locale })}
      footer={
        <Link to="/login" className="hover:text-foreground">
          {m.fp_back({}, { locale })}
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <KeyRound className="size-6" />
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{m.login_email({}, { locale })}</Label>
            <Input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder={m.login_email_ph({}, { locale })}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "…" : m.fp_send({}, { locale })}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          {m.fp_have_code({}, { locale })}{" "}
          <Link to="/reset-password" search={{ email }} className="font-medium text-primary hover:underline">
            {m.fp_enter_code({}, { locale })}
          </Link>
        </p>

        <p className="rounded-2xl bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
          {m.fp_stub({}, { locale })}
        </p>
      </div>
    </AuthShell>
  );
}
