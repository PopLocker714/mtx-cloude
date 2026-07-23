// Реконсиляция записи/событий по движению (Этап 3). Единый авторитет состояния записи:
// для motion-камер держит запись включённой, пока движение «свежее» (lastMotionAt в окне
// cooldown), и выключает по истечении; закрывает открытые события.
//
// Почему тик, а не только события: устойчиво к потерянным сообщениям и рестартам MediaMTX
// (конфиги путей рантайм-эфемерны). Failure-mode безопасный: pathDefaults record:yes, так что
// сбой = временная ПЕРЕзапись, никогда не потеря. appliedRecord пуст после рестарта → переприменяем.
import { and, eq, isNull, isNotNull, or } from "drizzle-orm";
import { db, schema } from "./db";
import { setRecording } from "./mediamtx";
import { MOTION_COOLDOWN_MS } from "./lib";

const appliedRecord = new Map<string, boolean>(); // path → последнее применённое состояние record

async function reconcileOnce() {
  const now = Date.now();
  // Релевантные камеры: motion-режим (нужен гейт) ИЛИ когда-либо было движение (могут быть
  // открытые события + свежий вход для гейта). Камеры, что никогда не двигались, не трогаем.
  const cams = await db
    .select()
    .from(schema.cameras)
    .where(or(eq(schema.cameras.recordMode, "motion"), isNotNull(schema.cameras.lastMotionAt)));

  for (const cam of cams) {
    const active = !!cam.lastMotionAt && now - cam.lastMotionAt.getTime() < MOTION_COOLDOWN_MS;

    // Закрываем открытое событие, когда окно движения истекло.
    if (!active) {
      await db
        .update(schema.events)
        .set({ endedAt: cam.lastMotionAt ?? new Date() })
        .where(and(eq(schema.events.cameraId, cam.id), isNull(schema.events.endedAt)));
    }

    // Гейт записи — только для motion-режима. continuous-камеры не трогаем (pathDefaults record:yes).
    if (cam.recordMode === "motion" && cam.enabled) {
      const desired = active;
      if (appliedRecord.get(cam.path) !== desired) {
        const ok = await setRecording(cam.path, desired);
        if (ok) appliedRecord.set(cam.path, desired);
      }
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startReconcile(intervalMs = Number(process.env.RECONCILE_INTERVAL_MS || 15_000)) {
  if (timer) return;
  timer = setInterval(() => {
    reconcileOnce().catch((e) => console.error("[reconcile] tick failed:", (e as Error).message));
  }, intervalMs);
  console.log("reconcile: цикл записи/событий по движению запущен");
}

// Сброс кэша применённого состояния для пути (после смены recordMode из ЛК),
// чтобы следующий тик гарантированно переприменил запись.
export function forgetRecordState(path: string) {
  appliedRecord.delete(path);
}
