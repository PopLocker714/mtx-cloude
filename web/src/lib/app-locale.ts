import { useEffect, useState } from "react";
import { LOCALES, type Locale } from "./i18n";

// Локаль ЛИЧНОГО КАБИНЕТА. У маркетинга локаль живёт в URL (/uk) ради SEO;
// у кабинета SEO нет, поэтому локаль — выбор пользователя в localStorage.
// Дефолт — украинский (основной рынок). Строки кабинета идут через paraglide
// с явной передачей локали, как и на маркетинговых страницах.

const KEY = "oko-app-locale";
const DEFAULT_LOCALE: Locale = "uk";

export function readAppLocale(): Locale {
  // Валидация против LOCALES, а не против списка литералов: добавление
  // локали в i18n.ts не должно требовать правки ещё и здесь.
  try {
    const v = localStorage.getItem(KEY);
    return (LOCALES as readonly string[]).includes(v ?? "") ? (v as Locale) : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function useAppLocale(): [Locale, (l: Locale) => void] {
  // SSR рендерит дефолт; на клиенте после маунта подставляется сохранённый
  // выбор. Гидрация совпадает, затем один быстрый ре-рендер при отличии.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(readAppLocale());
    const on = () => setLocaleState(readAppLocale());
    window.addEventListener("oko-locale-change", on);
    return () => window.removeEventListener("oko-locale-change", on);
  }, []);

  const setLocale = (l: Locale) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* приватный режим */
    }
    window.dispatchEvent(new CustomEvent("oko-locale-change"));
  };

  return [locale, setLocale];
}
