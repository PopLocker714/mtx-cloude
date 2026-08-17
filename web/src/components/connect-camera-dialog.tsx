import { useEffect, useState } from "react";
import { Check, Copy, Server, Terminal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import type { Locale } from "@/lib/i18n";
import { createCamera, getConnection, listBridges, type CameraConnection, type Bridge } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CopyField({ label, value, copyTitle }: { label: string; value: string; copyTitle: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" size="icon" onClick={copy} title={copyTitle}>
          {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingId?: string;
  onCreated?: () => void;
};

/** RTSP-URL из полей формы: креды энкодятся, путь чистится от ведущего /. */
function buildRtspUrl(f: { host: string; port: string; user: string; pass: string; path: string }): string {
  const creds = f.user ? `${encodeURIComponent(f.user)}:${encodeURIComponent(f.pass)}@` : "";
  const path = f.path.trim().replace(/^\/+/, "");
  return `rtsp://${creds}${f.host.trim()}:${f.port.trim() || "554"}${path ? `/${path}` : ""}`;
}

function guidesHref(locale: Locale): string {
  return locale === "en" ? "/guides" : `/${locale}/guides`;
}

export function ConnectCameraDialog({ open, onOpenChange, existingId, onCreated }: Props) {
  const [locale] = useAppLocale();
  const [mode, setMode] = useState<"bridge" | "manual">("bridge");
  // Камеру описываем полями, RTSP-ссылку собираем сами (никто не должен
  // вписывать пароль в строку руками). Целая ссылка — продвинутый вариант
  // для нестандартных камер.
  const [useRawUrl, setUseRawUrl] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("554");
  const [user, setUser] = useState("admin");
  const [pass, setPass] = useState("");
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [bridgeId, setBridgeId] = useState("");
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [conn, setConn] = useState<CameraConnection | null>(null); // ручной flow — данные подключения
  const [addedViaBridge, setAddedViaBridge] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode("bridge");
      setUseRawUrl(false);
      setHost("");
      setPort("554");
      setUser("admin");
      setPass("");
      setPath("");
      setName("");
      setSourceUrl("");
      setBridgeId("");
      setConn(null);
      setAddedViaBridge(false);
      setError(null);
      return;
    }
    if (existingId) {
      setBusy(true);
      getConnection(existingId)
        .then(setConn)
        .catch((e) => setError((e as Error).message))
        .finally(() => setBusy(false));
    } else {
      listBridges()
        .then((bs) => {
          const paired = bs.filter((b) => b.paired);
          setBridges(paired);
          if (paired[0]) setBridgeId(paired[0].id);
        })
        .catch(() => {});
    }
  }, [open, existingId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "bridge") {
        const url = useRawUrl ? sourceUrl : buildRtspUrl({ host, port, user, pass, path });
        await createCamera({ name: name || "Camera", bridgeId, sourceUrl: url });
        setAddedViaBridge(true);
        onCreated?.();
      } else {
        const c = await createCamera({ name: name || "Camera" });
        setConn(c);
        onCreated?.();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ffmpeg = conn
    ? `ffmpeg -rtsp_transport tcp -i "rtsp://LOGIN:PASSWORD@CAMERA_IP:554/stream" \\\n  -c copy -f rtsp -rtsp_transport tcp "${conn.ingestUrl}"`
    : "";

  // Экран после добавления через bridge
  if (addedViaBridge) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.ccd_added_title({}, { locale })}</DialogTitle>
            <DialogDescription>{m.ccd_added_desc({}, { locale })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>{m.ccd_done({}, { locale })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Экран данных подключения (ручной flow / существующая камера)
  if (conn) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.ccd_conn_title({ name: conn.name }, { locale })}</DialogTitle>
            <DialogDescription>{m.ccd_conn_desc({}, { locale })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <CopyField
              label={m.ccd_ingest_label({}, { locale })}
              value={conn.ingestUrl}
              copyTitle={m.ccd_copy({}, { locale })}
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{m.ccd_ffmpeg_label({}, { locale })}</Label>
              <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{ffmpeg}</pre>
              <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(ffmpeg)}>
                <Copy className="size-4" /> {m.ccd_copy_cmd({}, { locale })}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>{m.ccd_done({}, { locale })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{m.ccd_title({}, { locale })}</DialogTitle>
          <DialogDescription>
            {mode === "bridge" ? m.ccd_desc_bridge({}, { locale }) : m.ccd_desc_manual({}, { locale })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={create} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cam-name">{m.ccd_name({}, { locale })}</Label>
            <Input
              id="cam-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={m.ccd_name_ph({}, { locale })}
            />
          </div>

          {mode === "bridge" &&
            (bridges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {m.ccd_no_bridge_1({}, { locale })}{" "}
                <Link to="/bridges" className="underline" onClick={() => onOpenChange(false)}>
                  {m.ccd_no_bridge_link({}, { locale })}
                </Link>{" "}
                {m.ccd_no_bridge_2({}, { locale })}
              </p>
            ) : (
              <>
                {bridges.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="bridge">{m.ccd_bridge({}, { locale })}</Label>
                    <select
                      id="bridge"
                      value={bridgeId}
                      onChange={(e) => setBridgeId(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {bridges.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.online ? `(${m.home_online({}, { locale })})` : `(${m.home_offline({}, { locale })})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {useRawUrl ? (
                  <div className="space-y-2">
                    <Label htmlFor="src">{m.ccd_raw_label({}, { locale })}</Label>
                    <Input
                      id="src"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      placeholder="rtsp://admin:password@192.168.1.50:554/stream1"
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_6rem] gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="cam-host">{m.ccd_host({}, { locale })}</Label>
                        <Input
                          id="cam-host"
                          value={host}
                          onChange={(e) => setHost(e.target.value)}
                          placeholder="192.168.1.50"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cam-port">{m.ccd_port({}, { locale })}</Label>
                        <Input id="cam-port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="554" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="cam-user">{m.ccd_user({}, { locale })}</Label>
                        <Input id="cam-user" value={user} onChange={(e) => setUser(e.target.value)} placeholder="admin" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cam-pass">{m.ccd_pass({}, { locale })}</Label>
                        <Input
                          id="cam-pass"
                          type="password"
                          value={pass}
                          onChange={(e) => setPass(e.target.value)}
                          placeholder={m.ccd_pass_ph({}, { locale })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cam-path">
                        {m.ccd_path({}, { locale })}{" "}
                        <span className="text-muted-foreground">{m.ccd_optional({}, { locale })}</span>
                      </Label>
                      <Input
                        id="cam-path"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="stream1, ch01, live/ch00_0…"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        {m.ccd_path_help_1({}, { locale })}{" "}
                        <a href={guidesHref(locale)} target="_blank" rel="noreferrer" className="underline">
                          {m.ccd_path_help_link({}, { locale })}
                        </a>
                        .
                      </p>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setUseRawUrl(!useRawUrl)}
                >
                  {useRawUrl ? m.ccd_toggle_fields({}, { locale }) : m.ccd_toggle_raw({}, { locale })}
                </button>

                <p className="text-xs text-amber-600 dark:text-amber-500">{m.ccd_tip_dhcp({}, { locale })}</p>
              </>
            ))}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="items-center gap-3 sm:justify-between">
            {/* ffmpeg — намеренно незаметная ссылка: это путь для продвинутых. */}
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "bridge" ? "manual" : "bridge")}
            >
              {mode === "bridge" ? (
                <span className="inline-flex items-center gap-1">
                  <Terminal className="size-3" /> {m.ccd_adv_ffmpeg({}, { locale })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Server className="size-3" /> {m.ccd_mode_bridge({}, { locale })}
                </span>
              )}
            </button>
            <Button type="submit" disabled={busy || (mode === "bridge" && bridges.length === 0)}>
              {busy ? "…" : mode === "bridge" ? m.ccd_submit_add({}, { locale }) : m.ccd_submit_create({}, { locale })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
