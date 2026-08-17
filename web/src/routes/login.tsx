import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { signIn, signUp } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { SocialAuthButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const [locale] = useAppLocale();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup" && !accepted) {
      setError(m.login_accept_error({}, { locale }));
      return;
    }
    setError(null);
    setLoading(true);
    const res =
      mode === "signin"
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: name || email });
    if (res.error) {
      setLoading(false);
      return setError(res.error.message || m.login_error({}, { locale }));
    }
    // Регистрация → шаг подтверждения почты (заготовка флоу); вход → сразу в кабинет.
    // Полная навигация (не SPA): свежий заход с уже установленной кукой, без гонки кэша useSession.
    window.location.href =
      mode === "signup" ? `/verify-email?email=${encodeURIComponent(email)}` : "/home";
  }

  const signup = mode === "signup";

  return (
    <AuthShell
      title={signup ? m.login_signup_title({}, { locale }) : m.login_title({}, { locale })}
      subtitle={signup ? m.login_subtitle_signup({}, { locale }) : m.login_subtitle_signin({}, { locale })}
      footer={
        <Link to="/" className="hover:text-foreground">
          {m.auth_back_site({}, { locale })}
        </Link>
      }
    >
      <div className="space-y-6">
        <SocialAuthButtons />

        <form onSubmit={submit} className="space-y-4">
          {signup && (
            <div className="space-y-2">
              <Label htmlFor="name">{m.login_name({}, { locale })}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{m.login_email({}, { locale })}</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder={m.login_email_ph({}, { locale })}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="password">{m.login_password({}, { locale })}</Label>
              {!signup && (
                <Link
                  to="/forgot-password"
                  className="shrink-0 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground"
                >
                  {m.login_forgot({}, { locale })}
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {signup && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <span>
                {m.login_accept_prefix({}, { locale })}{" "}
                <Link to="/terms" target="_blank" className="underline">
                  {m.login_terms({}, { locale })}
                </Link>{" "}
                {m.login_accept_and({}, { locale })}{" "}
                <Link to="/privacy" target="_blank" className="underline">
                  {m.login_privacy({}, { locale })}
                </Link>
                .
              </span>
            </label>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={loading || (signup && !accepted)}>
            {loading ? "…" : signup ? m.login_signup_submit({}, { locale }) : m.login_submit({}, { locale })}
          </Button>
        </form>

        <button
          type="button"
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          onClick={() => {
            setMode(signup ? "signin" : "signup");
            setError(null);
          }}
        >
          {signup ? m.login_have_account({}, { locale }) : m.login_no_account({}, { locale })}
        </button>
      </div>
    </AuthShell>
  );
}
