import { useEffect, useState } from "react";
import { Video, Zap, Bell } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { listCameras, patchCamera, type Camera } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Настройки камеры: режим записи (непрерывно / по движению) + Telegram-уведомления (Этап 3).
export function CameraSettings({ cameraId }: { cameraId: string }) {
  const [locale] = useAppLocale();
  const [cam, setCam] = useState<Camera | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCameras()
      .then((cs) => setCam(cs.find((c) => c.id === cameraId) ?? null))
      .catch(() => {});
  }, [cameraId]);

  if (!cam) return null;
  const camera = cam;

  async function set(patch: { recordMode?: "continuous" | "motion"; notifyEnabled?: boolean }) {
    setBusy(true);
    try {
      await patchCamera(camera.id, patch);
      setCam({ ...camera, ...patch });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="size-4" /> {m.cs_title({}, { locale })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium mb-1.5">{m.cs_mode({}, { locale })}</div>
          <div className="inline-flex rounded-md border p-0.5">
            <button
              type="button"
              onClick={() => set({ recordMode: "continuous" })}
              disabled={busy}
              className={cn(
                "px-3 py-1.5 text-sm rounded transition",
                camera.recordMode === "continuous" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {m.cs_continuous({}, { locale })}
            </button>
            <button
              type="button"
              onClick={() => set({ recordMode: "motion" })}
              disabled={busy}
              className={cn(
                "px-3 py-1.5 text-sm rounded transition flex items-center gap-1",
                camera.recordMode === "motion" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <Zap className="size-3.5" /> {m.cs_motion({}, { locale })}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {camera.recordMode === "motion"
              ? m.cs_mode_motion_hint({}, { locale })
              : m.cs_mode_cont_hint({}, { locale })}
          </p>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={camera.notifyEnabled}
              disabled={busy}
              onChange={(e) => set({ notifyEnabled: e.target.checked })}
              className="size-4 accent-[var(--primary)]"
            />
            <Bell className="size-4" /> <span className="text-sm">{m.cs_notify({}, { locale })}</span>
          </label>
          <p className="text-xs text-muted-foreground mt-1 pl-6">{m.cs_notify_hint({}, { locale })}</p>
        </div>
      </CardContent>
    </Card>
  );
}
