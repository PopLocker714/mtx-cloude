// Клиент Control API MediaMTX — гейтинг записи по движению (Этап 3).
// authMethod:http в mediamtx.yml → наш auth-hook пускает action=api из приватной
// docker-сети (см. routes/mediamtx-auth.ts), поэтому доп. креды не нужны.
//
// Паттерн переключёния проверен эмпирически (v1.19.2): PATCH существующего конфига пути,
// при 404 (путь под all_others, своего конфига ещё нет) — ADD. Переключение record
// НЕ рвёт live-publisher и не пересоздаёт path — только запускает/останавливает recorder.
const MTX_API = (process.env.MTX_API_URL || "http://mediamtx:9997").replace(/\/+$/, "");

async function mtxFetch(url: string, method: string, body: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    return await fetch(url, { method, headers: { "content-type": "application/json" }, body, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Включить/выключить запись на пути. Идемпотентно. Возвращает true при успехе.
export async function setRecording(path: string, on: boolean): Promise<boolean> {
  const body = JSON.stringify({ record: on });
  const enc = encodeURIComponent(path);
  try {
    let r = await mtxFetch(`${MTX_API}/v3/config/paths/patch/${enc}`, "PATCH", body);
    if (r.status === 404) {
      r = await mtxFetch(`${MTX_API}/v3/config/paths/add/${enc}`, "POST", body);
    }
    if (!r.ok) {
      console.error(`[mediamtx] setRecording ${path}=${on}: HTTP ${r.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[mediamtx] setRecording ${path}=${on} failed:`, (e as Error).message);
    return false;
  }
}

// Удалить рантайм-конфиг пути (при удалении камеры) — чтобы не копить осиротевшие пути.
// Идемпотентно и best-effort: нет пути / MediaMTX недоступен → молча.
export async function deleteRecordingPath(path: string): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    await fetch(`${MTX_API}/v3/config/paths/delete/${encodeURIComponent(path)}`, { method: "DELETE", signal: ctrl.signal });
  } catch {
    /* нет пути под all_others или MediaMTX недоступен — не критично */
  } finally {
    clearTimeout(t);
  }
}
