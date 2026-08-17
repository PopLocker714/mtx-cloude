import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { m } from "@/paraglide/messages";
import { Button } from "@/components/ui/button";
import { pagePath, switchLocalePath, type Locale } from "@/lib/i18n";
import "@fontsource/ibm-plex-mono/400.css";

// Каркас публичных страниц: шапка, подвал, переключатель языка.
// Локаль приходит сверху из маршрута — компонент её не угадывает.
// Класс .marketing на корне включает маркетинговую палитру и шрифты
// (styles.css) и не трогает ЛК/админку.

/** Wordmark: «oko» с красной REC-точкой — весь бренд в одном глифе. */
function Brand({ locale }: { locale: Locale }) {
  return (
    <span className="flex items-baseline gap-0.5 font-display text-xl font-bold tracking-tight">
      {m.brand_name({}, { locale })}
      <span className="size-1.5 translate-y-[-1px] rounded-full bg-signal" aria-hidden />
    </span>
  );
}

function NavLinks({ locale, onNavigate }: { locale: Locale; onNavigate?: () => void }) {
  const items = [
    { to: pagePath("how-it-works", locale), label: m.nav_how({}, { locale }) },
    { to: pagePath("faq", locale), label: m.nav_faq({}, { locale }) },
    { to: pagePath("contact", locale), label: m.nav_contact({}, { locale }) },
  ];
  return (
    <>
      {items.map((i) => (
        <Link
          key={i.to}
          to={i.to}
          onClick={onNavigate}
          className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "whitespace-nowrap text-sm text-foreground" }}
        >
          {i.label}
        </Link>
      ))}
      {/* Тарифы — секция главной, не отдельная страница: якорь вместо маршрута. */}
      <Link
        to={pagePath("", locale)}
        hash="pricing"
        onClick={onNavigate}
        className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {m.nav_pricing({}, { locale })}
      </Link>
    </>
  );
}

export function MarketingShell({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="marketing flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to={pagePath("", locale)}>
            <Brand locale={locale} />
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <NavLinks locale={locale} />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* Переключатель ведёт на ТОТ ЖЕ путь в другой локали, а не на главную:
                увести читателя с середины FAQ на титульную — потерять его. */}
            <Link
              to={switchLocalePath(pathname)}
              className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
              hrefLang={locale === "uk" ? "en" : "uk"}
            >
              {m.nav_lang({}, { locale })}
            </Link>
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link to="/login">{m.nav_signin({}, { locale })}</Link>
            </Button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="md:hidden"
              aria-label="Menu"
              aria-expanded={open}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        {open && (
          <nav className="flex flex-col gap-3 border-t px-4 py-4 md:hidden">
            <NavLinks locale={locale} onNavigate={() => setOpen(false)} />
            <Link to="/login" className="text-sm" onClick={() => setOpen(false)}>
              {m.nav_signin({}, { locale })}
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Brand locale={locale} />
            <span>— {m.brand_tagline({}, { locale })}</span>
          </div>
          <div className="flex gap-4 sm:ml-auto">
            <Link to="/privacy" className="hover:text-foreground">
              {m.footer_privacy({}, { locale })}
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              {m.footer_terms({}, { locale })}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Полоса призыва к действию — повторяется в низу каждой страницы. */
export function CtaBand({ locale }: { locale: Locale }) {
  return (
    <section className="border-t bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {m.cta_band_title({}, { locale })}
        </h2>
        <p className="mt-3 text-muted-foreground">{m.cta_band_body({}, { locale })}</p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/login">{m.cta_band_button({}, { locale })}</Link>
        </Button>
      </div>
    </section>
  );
}
