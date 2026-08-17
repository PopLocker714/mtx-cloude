import { Link } from "@tanstack/react-router";
import { ShieldCheck, HardDrive, Plug } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedCard } from "@/components/marketing/visuals";

// Каркас страниц входа/подтверждения: слева форма, справа брендовая панель
// с живым кадром камеры и тремя доводами. На мобильных правая половина
// скрыта — на телефоне важна форма, а не витрина.

function LocalePicker() {
  const [locale, setLocale] = useAppLocale();
  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language"
      className="rounded-full border bg-background px-2 py-1 text-xs font-medium"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [locale] = useAppLocale();
  const points = [
    { icon: HardDrive, text: m.auth_point_1({}, { locale }) },
    { icon: ShieldCheck, text: m.auth_point_2({}, { locale }) },
    { icon: Plug, text: m.auth_point_3({}, { locale }) },
  ];

  return (
    <div className="marketing min-h-svh lg:grid lg:grid-cols-[1fr_1.05fr]">
      {/* Левая половина: шапка с брендом, форма по центру */}
      <div className="flex min-h-svh flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <Logo className="h-6" />
            <span className="font-display text-xl font-bold tracking-tight">oko</span>
          </Link>
          <div className="flex items-center gap-2">
            <LocalePicker />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-3xl font-medium">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </div>
        </main>

        {footer && <footer className="text-center text-xs text-muted-foreground">{footer}</footer>}
      </div>

      {/* Правая половина: витрина. Только на широких экранах. */}
      <aside className="relative hidden overflow-hidden bg-accent p-10 text-accent-foreground lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto w-full max-w-lg">
          <FeedCard locale={locale} />
          <h2 className="mt-10 font-display text-3xl font-medium leading-tight">
            {m.auth_panel_title({}, { locale })}
          </h2>
          <ul className="mt-6 space-y-4">
            {points.map((p) => (
              <li key={p.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-card">
                  <p.icon className="size-4 text-primary" />
                </span>
                <span className="text-sm leading-relaxed opacity-90">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
