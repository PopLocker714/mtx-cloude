import { ChevronDown } from "lucide-react";
import { useAppLocale } from "@/lib/app-locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

// Переключатель языка кабинета и экранов входа. Остаётся нативным select —
// на телефоне это родной пикер — но системная стрелка убрана, иначе белый
// прямоугольник выбивается из тёмной темы и из M3-элементов рядом.
export function LocaleSelect() {
  const [locale, setLocale] = useAppLocale();
  return (
    <div className="relative">
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label="Language"
        className="h-8 appearance-none rounded-full border bg-background pr-7 pl-3 text-xs font-medium text-foreground"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
