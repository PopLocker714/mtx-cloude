import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Server, Plus, Copy, Circle, Trash2, Ban, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { m } from "@/paraglide/messages";
import { useAppLocale } from "@/lib/app-locale";
import { listBridges, createBridge, claimBridge, revokeBridge, deleteBridge, type Bridge } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/bridges")({ component: BridgesPage });

function BridgesPage() {
  const [locale] = useAppLocale();
  const [bridges, setBridges] = useState<Bridge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ code: string } | null>(null);
  const [creating, setCreating] = useState(false);
  // Забор устройства, которое поставили заранее и которое ждёт владельца.
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  async function refresh() {
    try {
      setBridges(await listBridges());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    setCreating(true);
    try {
      const b = await createBridge("Bridge");
      setCreated({ code: b.pairingCode });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function claim() {
    setClaiming(true);
    setClaimError(null);
    try {
      await claimBridge(claimCode);
      setClaimOpen(false);
      setClaimCode("");
      await refresh();
    } catch (e) {
      setClaimError((e as Error).message);
    } finally {
      setClaiming(false);
    }
  }

  // Установка одной командой (основной путь). --network host нужен для ONVIF-обнаружения (Linux).
  // Короткая форма /i/КОД: вдвое меньше символов — команду часто набирают руками
  // на мини-ПК, где нет буфера обмена.
  const installCmd = created ? `curl -fsSL ${API_BASE}/i/${created.code} | sh` : "";
  const dockerCmd = created
    ? `docker run -d --name oko-bridge --restart unless-stopped --network host \\\n  -e OKO_API=${API_BASE} -e OKO_PAIR_CODE=${created.code} \\\n  -v oko-bridge-data:/data ghcr.io/poplocker714/oko-bridge:latest`
    : "";
  // QR для привязки: приложение-бридж (или бридж со сканером) читает адрес API и одноразовый код.
  const qrPayload = created ? JSON.stringify({ t: "oko-bridge", api: API_BASE, code: created.code }) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Server className="size-5" /> Bridge
        </h1>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" onClick={() => setClaimOpen(true)}>
            <Download className="size-4" /> {m.br_claim({}, { locale })}
          </Button>
          <Button onClick={add} disabled={creating}>
            <Plus className="size-4" /> {m.br_add({}, { locale })}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{m.br_intro({}, { locale })}</p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {bridges === null ? (
        <p className="text-muted-foreground">{m.app_loading({}, { locale })}</p>
      ) : bridges.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Server className="size-8 mx-auto mb-2 opacity-50" />
            {m.br_empty({}, { locale })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{m.br_col_name({}, { locale })}</TableHead>
                  <TableHead>{m.br_col_status({}, { locale })}</TableHead>
                  <TableHead>{m.br_col_version({}, { locale })}</TableHead>
                  <TableHead>{m.br_col_token({}, { locale })}</TableHead>
                  <TableHead className="text-right">{m.br_col_actions({}, { locale })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridges.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      {!b.paired ? (
                        <Badge variant="outline">{m.br_code({ code: b.pairingCode ?? "" }, { locale })}</Badge>
                      ) : b.online ? (
                        <span className="flex items-center gap-1.5 text-sm text-primary">
                          <Circle className="size-2 fill-primary" /> {m.home_online({}, { locale })}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Circle className="size-2 fill-muted-foreground" /> {m.home_offline({}, { locale })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.agentVersion ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{b.tokenPrefix ? b.tokenPrefix + "…" : "—"}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {b.paired && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeBridge(b.id).then(refresh)}
                          title={m.br_revoke_title({}, { locale })}
                        >
                          <Ban className="size-4" /> {m.br_revoke({}, { locale })}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteBridge(b.id).then(refresh)}
                        title={m.br_delete({}, { locale })}
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

      {/* Диалог с кодом привязки + командой запуска */}
      <Dialog open={created !== null} onOpenChange={(v) => !v && setCreated(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.br_created_title({}, { locale })}</DialogTitle>
            <DialogDescription>{m.br_created_desc({}, { locale })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* QR — быстрая привязка сканером; код и команды ниже как альтернатива */}
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={qrPayload} size={168} level="M" />
              </div>
              <p className="text-xs text-muted-foreground text-center">{m.br_qr_hint({}, { locale })}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{m.br_code_label({}, { locale })}</Label>
              <div className="text-2xl font-mono font-semibold tracking-widest text-center py-2 bg-muted rounded-md">
                {created?.code}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{m.br_install_label({}, { locale })}</Label>
              <pre className="rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">{installCmd}</pre>
              <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(installCmd)}>
                <Copy className="size-4" /> {m.ccd_copy_cmd({}, { locale })}
              </Button>
              <p className="text-xs text-muted-foreground">{m.br_install_hint({}, { locale })}</p>
            </div>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">{m.br_docker_alt({}, { locale })}</summary>
              <pre className="rounded-md bg-muted p-3 mt-2 font-mono whitespace-pre-wrap break-all">{dockerCmd}</pre>
              <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(dockerCmd)}>
                <Copy className="size-4" /> {m.ccd_copy({}, { locale })}
              </Button>
            </details>
            <p className="text-xs text-muted-foreground">{m.br_after_pair({}, { locale })}</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>{m.ccd_done({}, { locale })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Забор устройства: коробку поставили заранее, она показала свой код и ждёт владельца */}
      <Dialog open={claimOpen} onOpenChange={(v) => { setClaimOpen(v); if (!v) setClaimError(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.br_claim_title({}, { locale })}</DialogTitle>
            <DialogDescription>{m.br_claim_desc({}, { locale })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="device-code" className="text-xs text-muted-foreground">{m.br_claim_code({}, { locale })}</Label>
            <input
              id="device-code"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
              placeholder="ABCD-EFGH"
              autoFocus
              className="h-14 w-full rounded-xl border bg-background px-4 text-center text-2xl font-mono tracking-widest uppercase"
            />
            {claimError && <p className="text-sm text-destructive">{claimError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimOpen(false)}>{m.br_claim_cancel({}, { locale })}</Button>
            <Button onClick={claim} disabled={claiming || claimCode.replace(/-/g, "").length !== 8}>
              {claiming ? m.br_claiming({}, { locale }) : m.br_claim_go({}, { locale })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
