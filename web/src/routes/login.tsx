import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
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
      setError("Примите условия использования, чтобы продолжить.");
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
      return setError(res.error.message || "Ошибка");
    }
    // Регистрация → шаг подтверждения почты (заготовка флоу); вход → сразу в кабинет.
    // Полная навигация (не SPA): свежий заход с уже установленной кукой, без гонки кэша useSession.
    window.location.href =
      mode === "signup" ? `/verify-email?email=${encodeURIComponent(email)}` : "/home";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "signin" ? "Вход" : "Регистрация"}</CardTitle>
          <CardDescription>oko-cloud — облачное видеонаблюдение</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
                <span>
                  Я принимаю{" "}
                  <Link to="/terms" target="_blank" className="underline">условия использования</Link> и{" "}
                  <Link to="/privacy" target="_blank" className="underline">политику конфиденциальности</Link>.
                </span>
              </label>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || (mode === "signup" && !accepted)}>
              {loading ? "…" : mode === "signin" ? "Войти" : "Создать аккаунт"}
            </Button>
          </form>
          {mode === "signin" && (
            <p className="mt-3 text-center">
              <Link to="/forgot-password" className="text-sm text-muted-foreground underline">Забыли пароль?</Link>
            </p>
          )}
          <button
            type="button"
            className="mt-4 text-sm text-muted-foreground underline w-full text-center"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
