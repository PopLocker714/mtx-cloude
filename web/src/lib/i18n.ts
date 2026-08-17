// Двуязычность публичных страниц: английский базовый (без префикса), украинский на /uk.
//
// Локаль ВСЕГДА выводится из URL и передаётся в вызов сообщения явно —
// m.key({}, { locale }). Глобального состояния локали нет намеренно: при SSR
// два одновременных запроса на /faq и /uk/faq делят один процесс, и любая
// «текущая локаль» в модульной области рано или поздно отдала бы клиенту
// чужой язык. Явная передача делает это невозможным по построению.
//
// Из URL, а не из куки или Accept-Language, ещё и потому, что иначе поисковик
// не проиндексирует украинскую версию: робот приходит без куки и с чужими
// заголовками, и увидел бы английский на украинском адресе.

// ru добавлен по решению Ильи (итерация 9): не все в Украине говорят
// украинским, локализуем на три языка. en остаётся базовым (без префикса).
export const LOCALES = ["en", "uk", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const BASE_LOCALE: Locale = "en";
export const LOCALE_LABELS: Record<Locale, string> = { en: "EN", uk: "УК", ru: "РУ" };

// Публичный адрес сайта — нужен для canonical, hreflang и sitemap,
// которым обязательны абсолютные URL.
export const SITE_URL: string = (
  (import.meta.env.VITE_SITE_URL as string | undefined) || "https://app.tunnel.poploker.ru"
).replace(/\/+$/, "");

// Страницы сайта в одном месте: отсюда берутся и меню, и hreflang, и sitemap,
// поэтому забыть страницу в карте сайта, добавив её в меню, невозможно.
export const PAGES = ["", "how-it-works", "guides", "faq", "contact"] as const;
export type Page = (typeof PAGES)[number];

/** Путь страницы в нужной локали: ("faq","uk") → "/uk/faq", ("","en") → "/" */
export function pagePath(page: Page, locale: Locale): string {
  const prefix = locale === BASE_LOCALE ? "" : `/${locale}`;
  if (!page) return prefix || "/";
  return `${prefix}/${page}`;
}

/** Абсолютный URL страницы — для canonical, hreflang и sitemap. */
export function pageUrl(page: Page, locale: Locale): string {
  return `${SITE_URL}${pagePath(page, locale)}`;
}

/**
 * Ссылки-альтернативы для <head>. Взаимные hreflang обязательны: если en
 * ссылается на uk, а uk на en не ссылается, поисковик пару не склеит.
 * x-default отдаём на базовую локаль. Код языка именно `uk` — `ua` невалиден.
 */
export function alternateLinksFor(page: Page, canonical: Locale) {
  return [
    { rel: "canonical", href: pageUrl(page, canonical) },
    ...LOCALES.map((l) => ({ rel: "alternate", hreflang: l, href: pageUrl(page, l) })),
    { rel: "alternate", hreflang: "x-default", href: pageUrl(page, BASE_LOCALE) },
  ];
}

// Старые имена — обёртки, чтобы не трогать существующие вызовы.
export const alternateLinks = (page: Page) => alternateLinksFor(page, "en");
export const alternateLinksUk = (page: Page) => alternateLinksFor(page, "uk");

/** Локаль по пути — для атрибута lang у <html> в корневом шелле. */
export function localeFromPath(pathname: string): Locale {
  for (const l of LOCALES) {
    if (l === BASE_LOCALE) continue;
    if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return l;
  }
  return BASE_LOCALE;
}

/** Тот же путь в целевой локали — для трёхъязычного переключателя. */
export function pathInLocale(pathname: string, target: Locale): string {
  const current = localeFromPath(pathname);
  const rest = current === BASE_LOCALE ? pathname : pathname.replace(new RegExp(`^/${current}`), "") || "/";
  if (target === BASE_LOCALE) return rest || "/";
  return rest === "/" ? `/${target}` : `/${target}${rest}`;
}
