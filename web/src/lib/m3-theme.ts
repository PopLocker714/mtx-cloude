import {
  Hct,
  SchemeTonalSpot,
  MaterialDynamicColors,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";

// Material Design 3 динамический цвет (та же механика, что в material-web):
// из одного seed-цвета через HCT строится полная схема, которую мы маппим
// на shadcn-переменные. ОДИН источник правды для маппинга: этим же кодом
// пользуется и scripts/gen-m3-css.ts (статическая запечка бренд-палитры),
// и рантайм-пикер в ЛК.

export const DEFAULT_SEED = "#1e7a4f"; // бренд: «під охороною» зелёный

export const SEED_PRESETS = [
  { name: "Зелёный", hex: "#1e7a4f" },
  { name: "Синий", hex: "#3b62e0" },
  { name: "Фиолетовый", hex: "#7c4dff" },
  { name: "Бирюзовый", hex: "#00897b" },
  { name: "Янтарный", hex: "#b26a00" },
  { name: "Красный", hex: "#c5352b" },
] as const;

const STORAGE_KEY = "oko-theme-seed";

type DynamicColorName = keyof typeof MaterialDynamicColors;

function color(scheme: SchemeTonalSpot, name: DynamicColorName): string {
  const dc = MaterialDynamicColors[name] as { getArgb(s: SchemeTonalSpot): number };
  return hexFromArgb(dc.getArgb(scheme));
}

/** shadcn-переменные из seed-цвета: единый маппинг M3 → наши токены. */
export function buildVars(seedHex: string, isDark: boolean): Record<string, string> {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(seedHex)), isDark, 0);
  const c = (n: DynamicColorName) => color(scheme, n);
  return {
    "--background": c("surface"),
    "--foreground": c("onSurface"),
    "--card": isDark ? c("surfaceContainerLow") : c("surfaceContainerLowest"),
    "--card-foreground": c("onSurface"),
    "--popover": c("surfaceContainerLow"),
    "--popover-foreground": c("onSurface"),
    "--primary": c("primary"),
    "--primary-foreground": c("onPrimary"),
    "--secondary": c("secondaryContainer"),
    "--secondary-foreground": c("onSecondaryContainer"),
    "--muted": c("surfaceContainerHigh"),
    "--muted-foreground": c("onSurfaceVariant"),
    "--accent": c("primaryContainer"),
    "--accent-foreground": c("onPrimaryContainer"),
    "--destructive": c("error"),
    "--destructive-foreground": c("onError"),
    "--border": c("outlineVariant"),
    "--input": c("outlineVariant"),
    "--ring": c("primary"),
    "--sidebar": c("surfaceContainer"),
    "--sidebar-foreground": c("onSurface"),
    "--sidebar-primary": c("primary"),
    "--sidebar-primary-foreground": c("onPrimary"),
    "--sidebar-accent": c("secondaryContainer"),
    "--sidebar-accent-foreground": c("onSecondaryContainer"),
    "--sidebar-border": c("outlineVariant"),
    "--sidebar-ring": c("primary"),
  };
}

/** Применить seed к элементу (ЛК): переменные инлайном, наследуются вниз. */
export function applySeedToElement(el: HTMLElement, seedHex: string, isDark: boolean): void {
  const vars = buildVars(seedHex, isDark);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}

export function clearSeedFromElement(el: HTMLElement): void {
  for (const k of Object.keys(buildVars(DEFAULT_SEED, false))) el.style.removeProperty(k);
}

export function loadSeed(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSeed(hex: string | null): void {
  try {
    if (hex) localStorage.setItem(STORAGE_KEY, hex);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* приватный режим — просто не сохраняем */
  }
  window.dispatchEvent(new CustomEvent("oko-seed-change"));
}
