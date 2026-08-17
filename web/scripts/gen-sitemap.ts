// Карта сайта генерируется из того же списка страниц, что и меню с hreflang
// (src/lib/i18n.ts → PAGES). Так страница не может попасть в навигацию и
// потеряться в sitemap: источник один.
//
// Запускается перед сборкой (см. package.json → build), кладёт файл в public/,
// откуда его подхватывает статика.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, PAGES, pageUrl } from "../src/lib/i18n";
import { GUIDES, guideUrl } from "../src/lib/guides";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "public", "sitemap.xml");

// Взаимные hreflang нужны и в карте сайта, не только в <head>: поисковик
// склеивает языковые версии, только когда обе стороны ссылаются друг на друга.
const urls = PAGES.flatMap((page) =>
  LOCALES.map((locale) => {
    const alternates = LOCALES.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(page, l)}"/>`
    ).join("\n");
    return [
      "  <url>",
      `    <loc>${pageUrl(page, locale)}</loc>`,
      alternates,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(page, "en")}"/>`,
      `    <changefreq>weekly</changefreq>`,
      `    <priority>${page === "" ? "1.0" : "0.7"}</priority>`,
      "  </url>",
    ].join("\n");
  })
);

// Статьи /guides/<slug> — тем же правилом взаимных hreflang.
const guideUrls = GUIDES.flatMap((g) =>
  LOCALES.map((locale) => {
    const alternates = LOCALES.map(
      (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${guideUrl(g.slug, l)}"/>`
    ).join("\n");
    return [
      "  <url>",
      `    <loc>${guideUrl(g.slug, locale)}</loc>`,
      alternates,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${guideUrl(g.slug, "en")}"/>`,
      `    <changefreq>monthly</changefreq>`,
      `    <priority>0.6</priority>`,
      "  </url>",
    ].join("\n");
  })
);
urls.push(...guideUrls);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, xml, "utf8");
console.log(`sitemap: ${PAGES.length * LOCALES.length} URL → ${OUT}`);
