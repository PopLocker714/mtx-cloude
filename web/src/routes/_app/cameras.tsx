import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Video, Link2, Circle, Trash2, Radar, X } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
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
  const [locale] = useAppLocale();
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
        <h1 className="text-2xl font-semibold">{m.cam_title({}, { locale })}</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> {m.cam_add({}, { locale })}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Найденные агентом в сети ONVIF-камеры — подключение в один клик (ввести только пароль) */}
      {discovered.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="size-4 text-primary" /> {m.cam_found({ count: String(discovered.length) }, { locale })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {discovered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {d.name || d.model || m.cam_onvif_fallback({}, { locale })}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {[d.manufacturer, d.model].filter(Boolean).join(" ")}
                        {d.ip ? ` · ${d.ip}` : ""} · {d.bridgeName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" onClick={() => setAdoptTarget(d)}>
                        <Plus className="size-4" /> {m.cam_connect({}, { locale })}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={m.cam_hide({}, { locale })}
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
        <summary className="cursor-pointer font-medium text-foreground">{m.cam_help_summary({}, { locale })}</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>{m.cam_help_1({}, { locale })}</li>
          <li>{m.cam_help_2({}, { locale })}</li>
          <li>{m.cam_help_3({}, { locale })}</li>
          <li>{m.cam_help_4({}, { locale })}</li>
          <li>{m.cam_help_5({}, { locale })}</li>
        </ol>
      </details>

      {cameras === null ? (
        <p className="text-muted-foreground">{m.app_loading({}, { locale })}</p>
      ) : cameras.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Video className="size-8 mx-auto mb-2 opacity-50" />
            {m.cam_empty({}, { locale })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.cam_col_name({}, { locale })}</TableHead>
                  <TableHead>{m.cam_col_status({}, { locale })}</TableHead>
                  <TableHead>{m.cam_col_conn({}, { locale })}</TableHead>
                  <TableHead className="text-right">{m.cam_col_actions({}, { locale })}</TableHead>
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
                        <span className="flex items-center gap-1.5 text-sm text-primary">
                          <Circle className="size-2 fill-primary" /> {m.home_online({}, { locale })}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Circle className="size-2 fill-muted-foreground" /> {m.home_offline({}, { locale })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.viaBridge ? m.cam_via_bridge({}, { locale }) : m.cam_manual({}, { locale })}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/camera/$cameraId" params={{ cameraId: c.id }}>
                          <Video className="size-4" /> {m.cam_watch({}, { locale })}
                        </Link>
                      </Button>
                      {!c.viaBridge && (
                        <Button variant="outline" size="sm" onClick={() => setConnId(c.id)}>
                          <Link2 className="size-4" /> {m.cam_conn_data({}, { locale })}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title={m.cam_delete({}, { locale })}
                        onClick={() => {
                          if (confirm(m.cam_delete_confirm({ name: c.name }, { locale }))) {
                            deleteCamera(c.id).then(refresh);
                          }
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
