import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Scroll-reveal: добавляет .in, когда блок входит во вьюпорт. Один раз —
// дальше отключаемся, чтобы не дёргать контент при обратной прокрутке.
// Без IntersectionObserver (старый браузер, no-JS не наш случай — SSR
// отдаёт разметку целиком) просто показываем сразу.

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("reveal", className)} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
