import { useId } from "react";
import { cn } from "@/lib/utils";

// Логотип oko-cloud: облако, внутри которого живёт глаз-объектив.
// Глаз моргает и осматривается (CSS-классы logo-eye / logo-iris в styles.css).
// Цвета берутся из M3-схемы, так что логотип перекрашивается вместе с темой.

const CLOUD =
  "M33.5 25.5H12a6.8 6.8 0 1 1 1.8-13.36A9.6 9.6 0 0 1 32.3 14.2a6 6 0 0 1 1.2 11.3Z";

export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 44 30" className={cn("h-7 w-auto", className)} aria-hidden focusable="false">
      <defs>
        <clipPath id={id}>
          <path d={CLOUD} />
        </clipPath>
      </defs>
      {/* fill инлайном через var(): tailwind-классы fill-* на SVG теряет
          DOM-рендер скриншотов, а поведение в браузере то же самое. */}
      <path d={CLOUD} style={{ fill: "var(--accent)" }} />
      <g clipPath={`url(#${id})`}>
        <g className="logo-eye">
          <g className="logo-iris">
            <circle cx="22" cy="18.5" r="5.2" style={{ fill: "var(--primary)" }} />
            <circle cx="22" cy="18.5" r="2.3" style={{ fill: "var(--accent-foreground)" }} />
            <circle cx="23.6" cy="16.9" r="0.9" fill="#fff" opacity="0.85" />
          </g>
        </g>
      </g>
    </svg>
  );
}
