import { Link } from "@tanstack/react-router";
import { ShieldCheck, HardDrive, Plug, Download, ScanSearch, MonitorPlay, Mail } from "lucide-react";
import { m } from "@/paraglide/messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingShell, CtaBand } from "./Shell";
import { pagePath, type Locale } from "@/lib/i18n";

// Публичные страницы. Каждая принимает локаль сверху и передаёт её в каждый
// вызов сообщения — ни один компонент не «знает» текущий язык сам по себе.

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-16">{children}</div>;
}

function PageTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{children}</h1>;
}

export function HomePage({ locale }: { locale: Locale }) {
  const values = [
    { icon: HardDrive, t: m.value_1_title({}, { locale }), b: m.value_1_body({}, { locale }) },
    { icon: ShieldCheck, t: m.value_2_title({}, { locale }), b: m.value_2_body({}, { locale }) },
    { icon: Plug, t: m.value_3_title({}, { locale }), b: m.value_3_body({}, { locale }) },
  ];
  const steps = [
    { icon: Download, t: m.step_1_title({}, { locale }), b: m.step_1_body({}, { locale }) },
    { icon: ScanSearch, t: m.step_2_title({}, { locale }), b: m.step_2_body({}, { locale }) },
    { icon: MonitorPlay, t: m.step_3_title({}, { locale }), b: m.step_3_body({}, { locale }) },
  ];

  return (
    <MarketingShell locale={locale}>
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:py-28">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          {m.hero_title({}, { locale })}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
          {m.hero_sub({}, { locale })}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/login">{m.hero_cta({}, { locale })}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={pagePath("how-it-works", locale)}>{m.hero_cta_secondary({}, { locale })}</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{m.hero_note({}, { locale })}</p>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {m.value_title({}, { locale })}
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {values.map((v) => (
              <Card key={v.t}>
                <CardContent className="pt-6">
                  <v.icon className="size-6 text-muted-foreground" />
                  <h3 className="mt-4 font-medium">{v.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{v.b}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            {m.steps_title({}, { locale })}
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t}>
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background">
                    {i + 1}
                  </span>
                  <s.icon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mt-4 font-medium">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand locale={locale} />
    </MarketingShell>
  );
}

export function HowItWorksPage({ locale }: { locale: Locale }) {
  const blocks = [
    { t: m.how_bridge_title({}, { locale }), b: m.how_bridge_body({}, { locale }), extra: m.how_bridge_req({}, { locale }) },
    { t: m.how_cloud_title({}, { locale }), b: m.how_cloud_body({}, { locale }) },
    { t: m.how_access_title({}, { locale }), b: m.how_access_body({}, { locale }) },
    { t: m.how_offline_title({}, { locale }), b: m.how_offline_body({}, { locale }) },
  ];
  return (
    <MarketingShell locale={locale}>
      <Prose>
        <PageTitle>{m.how_title({}, { locale })}</PageTitle>
        <p className="mt-6 text-lg text-muted-foreground">{m.how_intro({}, { locale })}</p>

        {/* Схема пути потока — три узла, одна стрелка в одну сторону.
            Направление здесь несёт смысл: наружу открывает мост, а не мы. */}
        <div className="mt-10 flex flex-col items-stretch gap-3 rounded-lg border p-6 text-center text-sm sm:flex-row sm:items-center">
          <div className="flex-1 rounded-md bg-muted/50 px-4 py-3 font-medium">
            {locale === "uk" ? "Камера" : "Camera"}
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="flex-1 rounded-md bg-muted/50 px-4 py-3 font-medium">
            {locale === "uk" ? "Міст у вашій мережі" : "Bridge on your network"}
          </div>
          <div className="text-muted-foreground">→</div>
          <div className="flex-1 rounded-md bg-muted/50 px-4 py-3 font-medium">
            {locale === "uk" ? "Хмара oko" : "oko cloud"}
          </div>
        </div>

        {blocks.map((b) => (
          <section key={b.t} className="mt-10">
            <h2 className="text-xl font-semibold tracking-tight">{b.t}</h2>
            <p className="mt-3 text-muted-foreground">{b.b}</p>
            {b.extra && <p className="mt-3 text-muted-foreground">{b.extra}</p>}
          </section>
        ))}
      </Prose>
      <CtaBand locale={locale} />
    </MarketingShell>
  );
}

export function FaqPage({ locale }: { locale: Locale }) {
  const qa = [
    [m.faq_q1({}, { locale }), m.faq_a1({}, { locale })],
    [m.faq_q2({}, { locale }), m.faq_a2({}, { locale })],
    [m.faq_q3({}, { locale }), m.faq_a3({}, { locale })],
    [m.faq_q4({}, { locale }), m.faq_a4({}, { locale })],
    [m.faq_q5({}, { locale }), m.faq_a5({}, { locale })],
    [m.faq_q6({}, { locale }), m.faq_a6({}, { locale })],
    [m.faq_q7({}, { locale }), m.faq_a7({}, { locale })],
    [m.faq_q8({}, { locale }), m.faq_a8({}, { locale })],
  ];
  return (
    <MarketingShell locale={locale}>
      <Prose>
        <PageTitle>{m.faq_title({}, { locale })}</PageTitle>
        {/* Ответы открыты, а не спрятаны в аккордеон: поисковик индексирует текст,
            который есть в разметке, а читатель ищет глазами, а не кликами. */}
        <dl className="mt-10 divide-y">
          {qa.map(([q, a]) => (
            <div key={q} className="py-6">
              <dt className="font-medium">{q}</dt>
              <dd className="mt-2 text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>
      </Prose>
      <CtaBand locale={locale} />
    </MarketingShell>
  );
}

export const CONTACT_EMAIL = "hello@tunnel.poploker.ru";

export function ContactPage({ locale }: { locale: Locale }) {
  return (
    <MarketingShell locale={locale}>
      <Prose>
        <PageTitle>{m.contact_title({}, { locale })}</PageTitle>
        <p className="mt-6 text-lg text-muted-foreground">{m.contact_intro({}, { locale })}</p>

        <div className="mt-10 rounded-lg border p-6">
          <div className="flex items-center gap-3">
            <Mail className="size-5 text-muted-foreground" />
            <div>
              <div className="text-sm text-muted-foreground">{m.contact_email_label({}, { locale })}</div>
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">{m.contact_installer_title({}, { locale })}</h2>
          <p className="mt-3 text-muted-foreground">{m.contact_installer_body({}, { locale })}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">{m.contact_legal_title({}, { locale })}</h2>
          <p className="mt-3 text-muted-foreground">{m.contact_legal_placeholder({}, { locale })}</p>
        </section>
      </Prose>
      <CtaBand locale={locale} />
    </MarketingShell>
  );
}
