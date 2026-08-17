import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { m } from "@/paraglide/messages";
import { Button } from "@/components/ui/button";
import { pagePath, type Locale } from "@/lib/i18n";
import { Reveal } from "./reveal";

// Тарифы — витрина будущих планов: биллинга в продукте ещё нет, поэтому
// у платных CTA «написать нам», а сноска честно говорит, что сегодня всё
// бесплатно. Цены утверждены 2026-08-17 (ISA, Decisions): мы дешевле
// Partizan ($5.99/7дн, $17.99/31дн) и Videoloft ($8.99/30дн) почти вдвое.
// Валюта по локали: en → $, uk → ₴ (₴99/₴199 — округление вниз от курса).

const PRICE = {
  start: { en: "$2.49", uk: "₴99" },
  plus: { en: "$4.99", uk: "₴199" },
} as const;

type Plan = {
  key: "free" | "start" | "plus";
  name: () => string;
  price: (locale: Locale) => string;
  features: (locale: Locale) => Array<string>;
  highlighted: boolean;
};

export function PricingSection({ locale }: { locale: Locale }) {
  const plans: Array<Plan> = [
    {
      key: "free",
      name: () => m.plan_free_name({}, { locale }),
      price: (l) => (l === "uk" ? "₴0" : "$0"),
      features: (l) => [
        m.plan_free_f1({}, { locale: l }),
        m.plan_free_f2({}, { locale: l }),
        m.plan_f_resolution({}, { locale: l }),
        m.plan_f_browser({}, { locale: l }),
      ],
      highlighted: true,
    },
    {
      key: "start",
      name: () => "Start",
      price: (l) => PRICE.start[l],
      features: (l) => [
        m.plan_start_f1({}, { locale: l }),
        m.plan_f_unlimited({}, { locale: l }),
        m.plan_f_resolution({}, { locale: l }),
        m.plan_f_support({}, { locale: l }),
      ],
      highlighted: false,
    },
    {
      key: "plus",
      name: () => "Plus",
      price: (l) => PRICE.plus[l],
      features: (l) => [
        m.plan_plus_f1({}, { locale: l }),
        m.plan_f_unlimited({}, { locale: l }),
        m.plan_f_resolution({}, { locale: l }),
        m.plan_f_support({}, { locale: l }),
      ],
      highlighted: false,
    },
  ];

  return (
    <section id="pricing">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <h2 className="text-center font-display text-3xl font-medium sm:text-4xl">
            {m.pricing_title({}, { locale })}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            {m.pricing_sub({}, { locale })}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.key} delay={i * 100}>
            <div
              className={
                p.highlighted
                  ? "relative h-full rounded-[28px] bg-accent p-8 text-accent-foreground transition-shadow duration-300 hover:shadow-lg"
                  : "h-full rounded-[28px] bg-card p-8 transition-shadow duration-300 hover:shadow-md"
              }
            >
              {p.highlighted && (
                <span className="absolute -top-3.5 left-8 whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground">
                  {m.plan_free_badge({}, { locale })}
                </span>
              )}
              <h3 className="font-display text-lg font-medium">{p.name()}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-5xl font-medium">{p.price(locale)}</span>
                {p.key !== "free" && (
                  <span className={`whitespace-nowrap text-sm ${p.highlighted ? "opacity-70" : "text-muted-foreground"}`}>
                    {m.pricing_per_cam({}, { locale })}
                  </span>
                )}
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.features(locale).map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                variant={p.highlighted ? "default" : "secondary"}
                className="mt-8 w-full"
              >
                {p.key === "free" ? (
                  <Link to="/login">{m.pricing_free_cta({}, { locale })}</Link>
                ) : (
                  <Link to={pagePath("contact", locale)}>{m.pricing_paid_cta({}, { locale })}</Link>
                )}
              </Button>
            </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">{m.pricing_note({}, { locale })}</p>
        <p className="mt-2 text-center font-ticker text-xs tracking-wide text-muted-foreground">
          {m.pricing_compare({}, { locale })}
        </p>
      </div>
    </section>
  );
}
