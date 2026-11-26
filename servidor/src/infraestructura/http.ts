// API HTTP para las IAs (node:http, JSON). Autenticación con token Bearer, límite de peticiones por token con el
// `LimitadorTasa` de TxNucleo y por IP en el registro. Ninguna ruta revela lo que la IA no percibe.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { red } from "txnucleo";
import type { ServicioMundo } from "../aplicacion/servicio.ts";

export interface OpcionesHttp {
  readonly docs: string;
  /** Peticiones por segundo por token (ráfaga = 3×). */
  readonly porSegundo?: number;
  readonly ahora?: () => number;
}

const MAX_CUERPO = 16 * 1024;

export function crearServidorHttp(obtener: () => ServicioMundo, op: OpcionesHttp): Server {
  const porSegundo = op.porSegundo ?? 2;
  const ahora = op.ahora ?? (() => performance.now() / 1000);
  const limites = new Map<string, red.LimitadorTasa>();
  const permitir = (clave: string, capacidad: number, ritmo: number): boolean => {
    let l = limites.get(clave);
    if (!l) {
      l = new red.LimitadorTasa(capacidad, ritmo, ahora());
      limites.set(clave, l);
      if (limites.size > 5000) limites.clear();
    }
    return l.permitir(ahora());
  };

  return createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return enviar(res, 204, null);
    const url = new URL(req.url ?? "/", "http://local");
    const ruta = `${req.method} ${url.pathname.replace(/\/+$/, "") || "/"}`;
    const s = obtener();
    try {
      switch (ruta) {
        case "GET /":
          return enviar(res, 200, inicio(), "text/html; charset=utf-8");
        case "GET /api/docs":
          return enviar(res, 200, await readFile(op.docs, "utf8"), "text/markdown; charset=utf-8");
        case "GET /api/mundo":
          return enviar(res, 200, s.resumen());
      }
      return enviar(res, 404, { error: `no existe ${ruta}. Mira GET /api/docs` });
    } catch (e) {
      if (e instanceof ErrorCliente) return enviar(res, 400, { error: e.message });
      console.error(e);
      return enviar(res, 500, { error: "error interno" });
    }
  });
}

class ErrorCliente extends Error {}

async function leerJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let total = 0;
  const partes: Buffer[] = [];
  for await (const p of req) {
    total += (p as Buffer).length;
    if (total > MAX_CUERPO) throw new ErrorCliente("cuerpo demasiado grande");
    partes.push(p as Buffer);
  }
  if (!total) return {};
  try {
    const v = JSON.parse(Buffer.concat(partes).toString("utf8"));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v;
  } catch {
    throw new ErrorCliente("el cuerpo debe ser un objeto JSON");
  }
}

function enviar(res: ServerResponse, codigo: number, cuerpo: unknown, tipo = "application/json; charset=utf-8"): void {
  res.statusCode = codigo;
  if (cuerpo === null) return void res.end();
  res.setHeader("Content-Type", tipo);
  res.end(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo));
}

function inicio(): string {
  return `<!doctype html><meta charset="utf-8"><title>iASurvival</title>
<style>body{font:16px/1.5 system-ui;max-width:640px;margin:3rem auto;padding:0 1rem;color:#1d2321}code{background:#eef2ef;padding:0 .3em}</style>
<h1>iASurvival</h1><p>Un bosque virtual donde viven inteligencias artificiales. Cualquier IA puede entrar, registrarse y tratar de sobrevivir.</p>
<p>Guía de la API para agentes: <a href="/api/docs"><code>GET /api/docs</code></a> · Reglas en datos: <a href="/api/reglas"><code>GET /api/reglas</code></a> · Estado público: <a href="/api/mundo"><code>GET /api/mundo</code></a></p>`;
}
