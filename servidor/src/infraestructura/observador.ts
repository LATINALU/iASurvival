// Canal del observador humano (el visor 3D): WebSocket de solo lectura en /observador. Al conectar manda el
// terreno y los nodos; después, cada tick (5 Hz), el estado de las entidades, los nodos que cambiaron y los
// sucesos nuevos. Si IASURVIVAL_OBSERVADOR está definido hace falta ?token=<ese valor>; si no, solo localhost.

import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import type { ServicioMundo } from "../aplicacion/servicio.ts";
import { vistaTrazado } from "../dominio/vista.ts";
import { r1 } from "../dominio/mundo.ts";
import { codificarInicio } from "../dominio/inicio_binario.ts";
import type { EventoMundo } from "../dominio/tipos.ts";

export class Observadores {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly obtener: () => ServicioMundo;
  private readonly token: string | undefined;
  /** Comandos del observador (velocidad, poderes, salir). Responde con un objeto que se reenvía. */
  alComando: ((c: Record<string, unknown> & { tipo?: unknown }) => Promise<Record<string, unknown>> | Record<string, unknown>) | null = null;
  /** Velocidad actual del tiempo (para el visor). */
  velocidad: () => number = () => 1;
  private ultimoEnvio = 0;
  private ultimasTribus = 0;
  private versionTrazado = -1;

  constructor(http: Server, obtener: () => ServicioMundo, token = process.env.IASURVIVAL_OBSERVADOR) {
    this.obtener = obtener;
    this.token = token || undefined;
    http.on("upgrade", (req: IncomingMessage, socket: Duplex, cabeza: Buffer) => {
      const url = new URL(req.url ?? "/", "http://local");
      if (url.pathname !== "/observador" || !this.autorizado(req, url)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, cabeza, (ws) => this.conectar(ws));
    });
  }

  get cantidad(): number {
    return this.wss.clients.size;
  }

  private autorizado(req: IncomingMessage, url: URL): boolean {
    if (this.token) return url.searchParams.get("token") === this.token;
    const ip = req.socket.remoteAddress ?? "";
    return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  }

  private conectar(ws: WebSocket): void {
    const s = this.obtener();
    ws.send(codificarInicio(s.mundo));
    ws.send(JSON.stringify({ t: "historia", eventos: s.mundo.bitacora.filter((e) => e.interes >= 1).slice(-60) }));
    ws.send(JSON.stringify(s.tribus()));
    ws.send(JSON.stringify(vistaTrazado(s.mundo)));
    ws.send(JSON.stringify({ ...s.estado(), velocidad: this.velocidad() }));
    ws.on("message", async (crudo) => {
      let c: Record<string, unknown>;
      try {
        c = JSON.parse(String(crudo));
      } catch {
        return;
      }
      if (!this.alComando || typeof c !== "object" || !c) return;
      try {
        const r = await this.alComando(c);
        ws.send(JSON.stringify({ ...r, t: "respuesta", rid: c.rid ?? null, pedido: c.tipo }));
      } catch (e) {
        ws.send(JSON.stringify({ t: "respuesta", rid: c.rid ?? null, pedido: c.tipo, ok: false, error: String(e) }));
      }
    });
  }

  /** Difunde el tick actual (llamar después de cada paso). */
  difundir(eventos: readonly EventoMundo[]): void {
    if (this.wss.clients.size === 0) {
      this.obtener().mundo.nodosCambiados.clear();
      return;
    }
    const s = this.obtener();
    const m = s.mundo;
    const mensajes: string[] = [];
    // A camara rapida no hace falta mandar cada tick: como mucho ~6 estados por segundo real.
    const ahora = performance.now();
    if (ahora - this.ultimoEnvio >= 150 || eventos.length) {
      this.ultimoEnvio = ahora;
      mensajes.push(JSON.stringify({ ...s.estado(), velocidad: this.velocidad() }));
      if (m.nodosNuevos.size) {
        mensajes.push(JSON.stringify({ t: "nodos_nuevos", nodos: [...m.nodosNuevos].map((id) => m.nodos.get(id)).filter((n) => !!n).map((n) => [n!.id, n!.tipo, n!.variante, r1(n!.x), r1(n!.z), n!.nodo.disponible && !n!.quemado ? 1 : 0]) }));
        m.nodosNuevos.clear();
      }
      if (m.nodosCambiados.size) {
        mensajes.push(JSON.stringify({ t: "nodos", nodos: [...m.nodosCambiados].map((id) => { const n = m.nodos.get(id); return [id, n && n.nodo.disponible && !n.quemado ? 1 : 0]; }) }));
        m.nodosCambiados.clear();
      }
      if (m.versionTrazado !== this.versionTrazado) {
        this.versionTrazado = m.versionTrazado;
        mensajes.push(JSON.stringify(vistaTrazado(m)));
      }
      if (ahora - this.ultimasTribus > 1000) {
        this.ultimasTribus = ahora;
        mensajes.push(JSON.stringify(s.tribus()));
      }
    }
    if (eventos.length) mensajes.push(JSON.stringify({ t: "eventos", eventos }));
    for (const c of this.wss.clients) {
      if (c.readyState !== WebSocket.OPEN || c.bufferedAmount > 2_000_000) continue;
      for (const msg of mensajes) c.send(msg);
    }
  }

  cerrar(): void {
    for (const c of this.wss.clients) c.close();
    this.wss.close();
  }
}
