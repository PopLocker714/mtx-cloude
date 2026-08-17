import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { Button } from "@/components/ui/button";

// Переключатель светлой/тёмной темы. mounted-гард обязателен: до гидрации
// сервер не знает тему пользователя, и без гарда иконка даст hydration
// mismatch. До маунта рендерим нейтральную кнопку того же размера.

export function ThemeToggle() {
  const [locale] = useAppLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label={dark ? m.tt_light({}, { locale }) : m.tt_dark({}, { locale })}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {mounted ? dark ? <Sun className="size-4" /> : <Moon className="size-4" /> : <Moon className="size-4 opacity-0" />}
    </Button>
  );
}
