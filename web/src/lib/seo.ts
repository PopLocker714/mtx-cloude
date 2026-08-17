import { m } from "@/paraglide/messages";
import { alternateLinksFor, pageUrl, SITE_URL, type Locale, type Page } from "./i18n";

export const OG_LOCALE: Record<Locale, string> = { en: "en_US", uk: "uk_UA", ru: "ru_RU" };

// Заголовки и описания страниц в одном месте: маршрут просит head для своей
// страницы и локали, а не собирает мета-теги руками. Так пара en/uk не может
// разъехаться по canonical или забыть hreflang.

const TITLES: Record<Page, (l: Locale) => string> = {
  "": (l) => m.meta_home_title({}, { locale: l }),
  "how-it-works": (l) => m.meta_how_title({}, { locale: l }),
  guides: (l) => m.meta_guides_title({}, { locale: l }),
  faq: (l) => m.meta_faq_title({}, { locale: l }),
  contact: (l) => m.meta_contact_title({}, { locale: l }),
};

const DESCRIPTIONS: Record<Page, (l: Locale) => string> = {
  "": (l) => m.meta_home_desc({}, { locale: l }),
  "how-it-works": (l) => m.meta_how_desc({}, { locale: l }),
  guides: (l) => m.meta_guides_desc({}, { locale: l }),
  faq: (l) => m.meta_faq_desc({}, { locale: l }),
  contact: (l) => m.meta_contact_desc({}, { locale: l }),
};

export function pageHead(page: Page, locale: Locale) {
  const title = TITLES[page](locale);
  const description = DESCRIPTIONS[page](locale);
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: pageUrl(page, locale) },
      { property: "og:locale", content: OG_LOCALE[locale] },
      { property: "og:image", content: `${SITE_URL}/logo512.png` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: alternateLinksFor(page, locale),
  };
}
