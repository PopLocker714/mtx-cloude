import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Camera as CameraIcon, Server, Archive, Check, Copy, ArrowRight, Circle } from "lucide-react";
import { listCameras, listBridges, type Camera, type Bridge } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/home")({ component: HomeDashboard });

// Главная ЛК. Два состояния: онбординг «Get started», пока нет камер
// (шаги с реальной docker-командой и живым кодом привязки), и обзор
// со stat-плитками, когда камеры уже есть. Графиков нет намеренно:
// временных рядов API пока не отдаёт, рисовать нечего.

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-feed-faint hover:bg-white/10 hover:text-feed-foreground"
      aria-label="Скопировать"
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
function GetStarted({ bridges }: { bridges: Bridge[] }) {
  const hasBridge = bridges.length > 0;
  const paired = bridges.some((b) => b.paired);
  const pairCode = bridges.find((b) => !b.paired && b.pairingCode)?.pairingCode;

  // Два равных способа установки: скрипт (без Docker; ставит бинарник, ffmpeg
  // и systemd-сервис) и Docker для тех, у кого он уже есть.
  const installCmd = pairCode
    ? `curl -fsSL ${API_BASE}/i/${pairCode} | sh`
    : `curl -fsSL ${API_BASE}/install.sh | OKO_PAIR_CODE=<КОД-ПРИВЯЗКИ> sh`;
  const dockerCmd = `docker run -d --name oko-bridge --restart unless-stopped --network host \\
  -e OKO_API=${API_BASE} -e OKO_PAIR_CODE=${pairCode ?? "<КОД-ПРИВЯЗКИ>"} \\
  -v oko-bridge-data:/data ghcr.io/poplocker714/oko-bridge:latest`;

  const steps = [
    {
      done: hasBridge,
      title: "Добавьте bridge",
      body: "Bridge — небольшая программа в сети камер. Она сама найдёт камеры и отдаст поток в облако; наружу ничего открывать не нужно.",
      action: (
        <Button asChild size="sm" variant={hasBridge ? "secondary" : "default"}>
          <Link to="/bridges">
            {hasBridge ? "К списку bridge" : "Получить код привязки"} <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      ),
    },
    {
      done: paired,
      title: "Запустите bridge в сети камер",
      body: "Одна команда на любой Linux-машине рядом с камерами: мини-ПК, Raspberry Pi, старый компьютер. Скрипт сам поставит агент, ffmpeg и автозапуск; Docker не нужен. Есть Docker и он вам привычнее — второй вариант.",
      action: (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-xl bg-feed p-4 text-feed-foreground">
            <pre className="overflow-x-auto font-ticker text-xs leading-relaxed">{installCmd}</pre>
            <CopyButton text={installCmd} />
          </div>
          <details className="text-xs opacity-80">
            <summary className="cursor-pointer select-none">…или через Docker</summary>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-feed p-4 text-feed-foreground">
              <pre className="overflow-x-auto font-ticker text-xs leading-relaxed">{dockerCmd}</pre>
              <CopyButton text={dockerCmd} />
            </div>
          </details>
        </div>
      ),
    },
    {
      done: false,
      title: "Подключите камеру",
      body: "Привязанный bridge просканирует сеть по ONVIF и покажет найденные камеры — останется ввести пароль камеры. Семь дней архива каждой камеры — бесплатно.",
      action: (
        <Button asChild size="sm" variant={paired ? "default" : "secondary"} disabled={!paired}>
          <Link to="/cameras">
            К камерам <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="rounded-3xl bg-accent p-8 text-accent-foreground">
      <h2 className="font-display text-2xl font-medium">Подключите первую камеру</h2>
      <p className="mt-2 max-w-2xl opacity-80">
        Обычно это занимает около десяти минут. Три шага — и в облаке появится живая картинка и семидневный архив.
      </p>
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
function OnlineBadge({ online }: { online: boolean }) {
  return (
    <Badge variant="outline" className={online ? "border-primary/40 text-primary" : "text-muted-foreground"}>
      <Circle className={`size-2 ${online ? "fill-primary" : "fill-muted-foreground/50"}`} />
      {online ? "онлайн" : "офлайн"}
    </Badge>
  );
}

function Dashboard({ cameras, bridges }: { cameras: Camera[]; bridges: Bridge[] }) {
  const camsOnline = cameras.filter((c) => c.online).length;
  const bridgesOnline = bridges.filter((b) => b.online).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          icon={CameraIcon}
          label="Камеры"
          value={String(cameras.length)}
          sub={<OnlineBadge online={camsOnline > 0} />}
        />
        <StatTile
          icon={Server}
          label="Bridge"
          value={String(bridges.length)}
          sub={`онлайн: ${bridgesOnline} из ${bridges.length}`}
        />
        <StatTile icon={Archive} label="Архив" value="7 дней" sub="по кругу, бесплатно для каждой камеры" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Камеры</CardTitle>
          <CardDescription>
            онлайн {camsOnline} из {cameras.length}
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
              <OnlineBadge online={c.online} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HomeDashboard() {
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
    return <p className="text-sm text-muted-foreground">Загрузка…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-medium">Главная</h1>
      {cameras.length === 0 ? <GetStarted bridges={bridges} /> : <Dashboard cameras={cameras} bridges={bridges} />}
    </div>
  );
}
