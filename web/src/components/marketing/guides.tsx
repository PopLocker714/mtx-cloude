import { Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, TriangleAlert } from "lucide-react";
import { MarketingShell, CtaBand } from "./Shell";
import { Reveal } from "./reveal";
import { GUIDES, type Guide } from "@/lib/guides";
import type { Locale } from "@/lib/i18n";

// Раздел «Інструкції»: как включить ONVIF/RTSP на конкретном бренде камеры.
// Это и онбординг (из ЛК сюда ведёт диалог добавления камеры), и SEO-страницы.

const T = {
  uk: {
    title: "Інструкції з підключення камер",
    intro:
      "Як увімкнути ONVIF або RTSP на популярних камерах і підключити їх до oko. Не знайшли свою камеру? Якщо вона говорить RTSP або ONVIF — вона підійде: подивіться в її налаштуваннях пункти з цими словами.",
    steps: "Кроки",
    rtsp: "RTSP-адреси (замініть IP на адресу вашої камери)",
    creds: "Логін і пароль",
    caveats: "Нюанси",
    all: "Всі інструкції",
    open: "Відкрити",
  },
  en: {
    title: "Camera connection guides",
    intro:
      "How to enable ONVIF or RTSP on popular cameras and connect them to oko. Camera not listed? If it speaks RTSP or ONVIF, it will work — look for those words in its settings.",
    steps: "Steps",
    rtsp: "RTSP addresses (replace IP with your camera's address)",
    creds: "Login and password",
    caveats: "Caveats",
    all: "All guides",
    open: "Open",
  },
} as const;

export function GuidesIndexPage({ locale }: { locale: Locale }) {
  const t = T[locale];
  return (
    <MarketingShell locale={locale}>
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-3xl font-medium sm:text-4xl">{t.title}</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">{t.intro}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {GUIDES.map((g, i) => (
            <Reveal key={g.slug} delay={i * 60}>
              <Link
                to={locale === "uk" ? "/uk/guides/$slug" : "/guides/$slug"}
                params={{ slug: g.slug }}
                className="flex h-full items-center justify-between gap-4 rounded-[28px] bg-card p-6 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="font-display text-lg font-medium">{g.brand}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{g[locale].title}</div>
                </div>
                <ArrowRight className="size-5 shrink-0 text-primary" />
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
      <CtaBand locale={locale} />
    </MarketingShell>
  );
}

export function GuidePage({ guide, locale }: { guide: Guide; locale: Locale }) {
  const t = T[locale];
  const c = guide[locale];
  return (
    <MarketingShell locale={locale}>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link
          to={locale === "uk" ? "/uk/guides" : "/guides"}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t.all}
        </Link>
        <h1 className="mt-4 font-display text-3xl font-medium sm:text-4xl">{c.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{c.intro}</p>

        <h2 className="mt-10 font-display text-xl font-medium">{t.steps}</h2>
        <ol className="mt-4 space-y-3">
          {c.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent font-ticker text-xs font-medium text-accent-foreground">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed sm:text-base">{s}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 font-display text-xl font-medium">{t.rtsp}</h2>
        <div className="mt-4 space-y-2 rounded-[20px] bg-feed p-5 text-feed-foreground">
          {c.rtsp.map((r) => (
            <div key={r.url} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="text-xs text-feed-faint">{r.label}</span>
              <code className="font-ticker text-xs sm:text-sm">{r.url}</code>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3 rounded-[20px] bg-accent p-5 text-accent-foreground">
          <KeyRound className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm leading-relaxed">{c.creds}</p>
        </div>

        <h2 className="mt-10 font-display text-xl font-medium">{t.caveats}</h2>
        <ul className="mt-4 space-y-3">
          {c.caveats.map((w) => (
            <li key={w} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
              {w}
            </li>
          ))}
        </ul>
      </div>
      <CtaBand locale={locale} />
    </MarketingShell>
  );
}
