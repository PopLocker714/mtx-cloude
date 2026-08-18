import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Camera as CameraIcon, Server, Archive, Check, Copy, ArrowRight, Circle } from "lucide-react";
import { m } from "@/paraglide/messages";
import { listCameras, listBridges, type Camera, type Bridge } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { useAppLocale } from "@/lib/app-locale";
import type { Locale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/home")({ component: HomeDashboard });

// Главная ЛК. Два состояния: онбординг «Get started», пока нет камер
// (шаги с реальной командой установки и живым кодом привязки), и обзор
// со stat-плитками, когда камеры уже есть. Графиков нет намеренно:
// временных рядов API пока не отдаёт, рисовать нечего.

function CopyButton({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-feed-faint hover:bg-white/10 hover:text-feed-foreground"
      aria-label={label}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        });
      }}
    >
      {ok ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}

/** Онбординг: три шага до первой камеры, с отметками done по факту. */
function GetStarted({ bridges, locale }: { bridges: Bridge[]; locale: Locale }) {
  const hasBridge = bridges.length > 0;
  const paired = bridges.some((b) => b.paired);
  const pairCode = bridges.find((b) => !b.paired && b.pairingCode)?.pairingCode;

  // Два равных способа установки: скрипт (без Docker; ставит бинарник, ffmpeg
  // и systemd-сервис) и Docker для тех, у кого он уже есть.
  const installCmd = pairCode
    ? `curl -fsSL ${API_BASE}/i/${pairCode} | sh`
    : `curl -fsSL ${API_BASE}/install.sh | OKO_PAIR_CODE=<CODE> sh`;
  const dockerCmd = `docker run -d --name oko-bridge --restart unless-stopped --network host \\
  -e OKO_API=${API_BASE} -e OKO_PAIR_CODE=${pairCode ?? "<CODE>"} \\
  -v oko-bridge-data:/data ghcr.io/poplocker714/oko-bridge:latest`;

  const copyLabel = m.home_copy({}, { locale });

  const steps = [
    {
      done: hasBridge,
      title: m.home_s1_title({}, { locale }),
      body: m.home_s1_body({}, { locale }),
      action: (
        <Button asChild size="sm" variant={hasBridge ? "secondary" : "default"}>
          <Link to="/bridges">
            {hasBridge ? m.home_s1_btn_done({}, { locale }) : m.home_s1_btn({}, { locale })}{" "}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      ),
    },
    {
      done: paired,
      title: m.home_s2_title({}, { locale }),
      body: m.home_s2_body({}, { locale }),
      action: (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-xl bg-feed p-4 text-feed-foreground">
            <pre className="overflow-x-auto font-ticker text-xs leading-relaxed break-all whitespace-pre-wrap sm:whitespace-pre">{installCmd}</pre>
            <CopyButton text={installCmd} label={copyLabel} />
          </div>
          <details className="text-xs opacity-80">
            <summary className="cursor-pointer select-none">{m.home_s2_docker({}, { locale })}</summary>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-feed p-4 text-feed-foreground">
              <pre className="overflow-x-auto font-ticker text-xs leading-relaxed break-all whitespace-pre-wrap sm:whitespace-pre">{dockerCmd}</pre>
              <CopyButton text={dockerCmd} label={copyLabel} />
            </div>
          </details>
        </div>
      ),
    },
    {
      done: false,
      title: m.home_s3_title({}, { locale }),
      body: m.home_s3_body({}, { locale }),
      action: (
        <Button asChild size="sm" variant={paired ? "default" : "secondary"} disabled={!paired}>
          <Link to="/cameras">
            {m.home_s3_btn({}, { locale })} <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="rounded-3xl bg-accent p-8 text-accent-foreground">
      <h2 className="font-display text-2xl font-medium">{m.home_gs_title({}, { locale })}</h2>
      <p className="mt-2 max-w-2xl opacity-80">{m.home_gs_sub({}, { locale })}</p>
      <ol className="mt-8 space-y-6">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-full font-ticker text-sm font-medium ${
                s.done ? "bg-primary text-primary-foreground" : "bg-card text-foreground"
              }`}
            >
              {s.done ? <Check className="size-5" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h3 className="font-display font-medium">{s.title}</h3>
                <p className="mt-1 text-sm opacity-80">{s.body}</p>
              </div>
              {s.action}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-card p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <div className="mt-3 font-display text-4xl font-medium">{value}</div>
      {sub && <div className="mt-2 text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** Статус словом + точкой: цвет никогда не единственный носитель смысла. */
function OnlineBadge({ online, locale }: { online: boolean; locale: Locale }) {
  return (
    <Badge variant="outline" className={online ? "border-primary/40 text-primary" : "text-muted-foreground"}>
      <Circle className={`size-2 ${online ? "fill-primary" : "fill-muted-foreground/50"}`} />
      {online ? m.home_online({}, { locale }) : m.home_offline({}, { locale })}
    </Badge>
  );
}

function Dashboard({ cameras, bridges, locale }: { cameras: Camera[]; bridges: Bridge[]; locale: Locale }) {
  const camsOnline = cameras.filter((c) => c.online).length;
  const bridgesOnline = bridges.filter((b) => b.online).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={CameraIcon}
          label={m.home_tile_cameras({}, { locale })}
          value={String(cameras.length)}
          sub={<OnlineBadge online={camsOnline > 0} locale={locale} />}
        />
        <StatTile
          icon={Server}
          label={m.home_tile_bridges({}, { locale })}
          value={String(bridges.length)}
          sub={m.home_online_of({ online: String(bridgesOnline), total: String(bridges.length) }, { locale })}
        />
        <StatTile
          icon={Archive}
          label={m.home_tile_archive({}, { locale })}
          value={m.home_tile_archive_value({}, { locale })}
          sub={m.home_tile_archive_sub({}, { locale })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{m.home_cameras_list({}, { locale })}</CardTitle>
          <CardDescription>
            {m.home_online_of({ online: String(camsOnline), total: String(cameras.length) }, { locale })}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {cameras.map((c) => (
            <Link
              key={c.id}
              to="/camera/$cameraId"
              params={{ cameraId: c.id }}
              className="flex items-center gap-3 py-3 transition-colors hover:text-primary"
            >
              <CameraIcon className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="hidden font-ticker text-xs text-muted-foreground sm:inline">{c.path}</span>
              <OnlineBadge online={c.online} locale={locale} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HomeDashboard() {
  const [locale] = useAppLocale();
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [bridges, setBridges] = useState<Bridge[] | null>(null);

  useEffect(() => {
    Promise.all([listCameras(), listBridges()])
      .then(([c, b]) => {
        setCameras(c);
        setBridges(b);
      })
      .catch(() => {
        setCameras([]);
        setBridges([]);
      });
  }, []);

  if (cameras === null || bridges === null)
    return <p className="text-sm text-muted-foreground">{m.app_loading({}, { locale })}</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-medium">{m.home_title({}, { locale })}</h1>
      {cameras.length === 0 ? (
        <GetStarted bridges={bridges} locale={locale} />
      ) : (
        <Dashboard cameras={cameras} bridges={bridges} locale={locale} />
      )}
    </div>
  );
}
