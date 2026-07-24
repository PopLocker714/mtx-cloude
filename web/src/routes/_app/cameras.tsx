import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Video, Link2, Circle, Trash2, Radar, X } from "lucide-react";
import {
  listCameras,
  deleteCamera,
  listDiscovered,
  dismissDiscovered,
  type Camera,
  type DiscoveredCamera,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConnectCameraDialog } from "@/components/connect-camera-dialog";
import { AdoptCameraDialog } from "@/components/adopt-camera-dialog";

export const Route = createFileRoute("/_app/cameras")({ component: CamerasPage });

function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredCamera[]>([]);
  const [adoptTarget, setAdoptTarget] = useState<DiscoveredCamera | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [connId, setConnId] = useState<string | null>(null);

  async function refresh() {
    try {
      const [cams, disc] = await Promise.all([listCameras(), listDiscovered().catch(() => [])]);
      setCameras(cams);
      setDiscovered(disc);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Мои камеры</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Добавить камеру
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Найденные агентом в сети ONVIF-камеры — подключение в один клик (ввести только пароль) */}
      {discovered.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="size-4 text-primary" /> Найдены камеры в вашей сети ({discovered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {discovered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.name || d.model || "ONVIF-камера"}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {[d.manufacturer, d.model].filter(Boolean).join(" ")}
                        {d.ip ? ` · ${d.ip}` : ""} · {d.bridgeName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" onClick={() => setAdoptTarget(d)}>
                        <Plus className="size-4" /> Подключить
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Скрыть"
                        onClick={() => dismissDiscovered(d.id).then(refresh)}
                      >
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Помощь: если камера не нашлась (самая частая точка затыка) */}
      <details className="text-sm text-muted-foreground rounded-md border bg-muted/30 p-3">
        <summary className="cursor-pointer font-medium text-foreground">Не видите свою камеру?</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Камера и bridge в одной сети (Wi-Fi обычно 2.4 ГГц, не 5 ГГц)?</li>
          <li>
            Включён ли <b>ONVIF</b> в приложении камеры? У многих он выключен с завода — включается одним
            тумблером (напр. V380: Настройки → Дополнительно → ONVIF).
          </li>
          <li>
            Bridge запущен на <b>Linux</b> с <code>--network host</code>? На Mac авто-поиск камер не работает —
            добавьте камеру вручную.
          </li>
          <li>Логин/пароль не знаете? Частый вариант — <b>admin</b> и пустой пароль.</li>
          <li>Всё равно нет — «Добавить камеру» → «Вручную» и вставьте RTSP-ссылку камеры.</li>
        </ol>
      </details>

      {cameras === null ? (
        <p className="text-muted-foreground">Загрузка…</p>
      ) : cameras.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Video className="size-8 mx-auto mb-2 opacity-50" />
            Пока нет камер. Нажмите «Добавить камеру», чтобы получить данные для подключения.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Подключение</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cameras.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link to="/camera/$cameraId" params={{ cameraId: c.id }} className="hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {c.online ? (
                        <span className="flex items-center gap-1.5 text-sm text-green-600">
                          <Circle className="size-2 fill-green-600" /> онлайн
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Circle className="size-2 fill-muted-foreground" /> офлайн
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.viaBridge ? "через bridge" : "вручную"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/camera/$cameraId" params={{ cameraId: c.id }}>
                          <Video className="size-4" /> Смотреть
                        </Link>
                      </Button>
                      {!c.viaBridge && (
                        <Button variant="outline" size="sm" onClick={() => setConnId(c.id)}>
                          <Link2 className="size-4" /> Данные
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Удалить"
                        onClick={() => {
                          if (confirm(`Удалить камеру «${c.name}»?`)) deleteCamera(c.id).then(refresh);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Мастер добавления новой камеры */}
      <ConnectCameraDialog open={addOpen} onOpenChange={setAddOpen} onCreated={refresh} />

      {/* Данные подключения существующей камеры */}
      <ConnectCameraDialog open={connId !== null} onOpenChange={(v) => !v && setConnId(null)} existingId={connId ?? undefined} />

      {/* Усыновление найденной ONVIF-камеры */}
      <AdoptCameraDialog camera={adoptTarget} onOpenChange={(v) => !v && setAdoptTarget(null)} onAdopted={refresh} />
    </div>
  );
}
