import { buildVars, DEFAULT_SEED } from "../src/lib/m3-theme";

// Запекает бренд-палитру (seed по умолчанию) в статический CSS, чтобы
// сайт красился без JS: SSR, прекраска до гидрации, no-JS краулеры.
// Запуск: bun scripts/gen-m3-css.ts (алиас: bun run gen:theme).

function block(selector: string, vars: Record<string, string>): string {
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

const css = `/* АВТОГЕНЕРАЦИЯ — не редактировать руками. Источник: scripts/gen-m3-css.ts
 * (Material Design 3, seed ${DEFAULT_SEED}, маппинг в src/lib/m3-theme.ts). */

${block(":root", buildVars(DEFAULT_SEED, false))}

${block(".dark", buildVars(DEFAULT_SEED, true))}
`;

await Bun.write(new URL("../src/m3-tokens.css", import.meta.url), css);
console.log("src/m3-tokens.css written");
