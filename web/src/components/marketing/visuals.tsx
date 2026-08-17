import { m } from "@/paraglide/messages";
import type { Locale } from "@/lib/i18n";

// Визуальный мир камер: тёмные feed-компоненты на светлой странице.
// Всё нарисовано CSS-ом, без изображений — имитация фида остаётся
// абстрактно-технической, чтобы не притворяться фотографией.

/** Стилизованный кадр наблюдения — правая половина hero. */
export function FeedCard({ locale }: { locale: Locale }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-feed text-feed-foreground shadow-2xl ring-1 ring-black/20">
      {/* Верхняя панель: REC + имя камеры + LIVE */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 font-ticker text-[11px] tracking-wider">
        <span className="size-2 animate-rec rounded-full bg-signal" aria-hidden />
        <span className="text-feed-faint">REC</span>
        <span className="ml-2 truncate">{m.feed_cam({}, { locale })}</span>
        <span className="ml-auto rounded-sm bg-signal/15 px-1.5 py-0.5 text-signal">LIVE</span>
      </div>

      {/* «Кадр»: сетка, виньетка, рамка детекции движения */}
      <div className="relative aspect-video">
        <div
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgb(0 0 0 / 0.5) 100%)" }}
          aria-hidden
        />
        <div className="absolute left-[14%] top-[22%] h-[38%] w-[30%] rounded-sm border border-signal/70">
          <span className="absolute -top-5 left-0 font-ticker text-[10px] tracking-wider text-signal">
            {m.feed_motion({}, { locale })}
          </span>
        </div>
        <span className="absolute bottom-3 right-4 font-ticker text-[11px] text-feed-faint">1080p · H.264</span>
      </div>

      {/* Нижняя панель: неделя архива как таймлайн */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-full bg-primary/70 first:bg-primary/40" />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-ticker text-[10px] tracking-wider text-feed-faint">
          <span>−7 {m.feed_days_short({}, { locale })}</span>
          <span>{m.feed_archive({}, { locale })}</span>
          <span>{m.retention_today({}, { locale })}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Signature-элемент: полоса хранения. Старые сегменты растворяются,
 * семь последних суток держатся — «7 діб завжди безкоштовно» в одной картинке.
 */
export function RetentionStrip({ locale }: { locale: Locale }) {
  const ghosts = 3;
  const held = 7;
  return (
    <div>
      <div className="flex items-end gap-1.5 sm:gap-2" aria-hidden>
        {Array.from({ length: ghosts }, (_, i) => (
          <div
            key={`g${i}`}
            className="h-10 flex-1 rounded-md border border-dashed border-white/15 sm:h-14"
            style={{ opacity: 0.25 + i * 0.12 }}
          />
        ))}
        {Array.from({ length: held }, (_, i) => (
          <div key={`h${i}`} className="flex-1">
            <div className="h-14 rounded-md bg-primary/80 ring-1 ring-white/10 sm:h-20" />
            <div className="mt-2 text-center font-ticker text-[10px] tracking-wider text-feed-faint">
              {i === held - 1 ? m.retention_today({}, { locale }) : `−${held - 1 - i}`}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between font-ticker text-[11px] tracking-wider text-feed-faint">
        <span>{m.retention_deleted({}, { locale })}</span>
        <span className="text-feed-foreground">{m.retention_held({}, { locale })}</span>
      </div>
    </div>
  );
}
