// Integración: el motor real (bucle + WebSocket + guardado) en un puerto libre y una carpeta temporal; el
// observador recibe el mundo, pide una ficha y usa un poder.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { arrancar } from "../src/principal.ts";
import { decodificarInicio } from "../src/dominio/inicio_binario.ts";

test("observador: inicio, tribus, estado, ficha, poder y guardado", async () => {
  const datos = await mkdtemp(join(tmpdir(), "iasurvival-"));
  const vivo = await arrancar({ puerto: 0, datos, velocidad: 4, nuevo: true, semilla: 4, tribus: 2, colonos: 3 });
  const base = `ws://127.0.0.1:${(vivo.http.address() as AddressInfo).port}/observador`;
  try {
    const ws = new WebSocket(base);
    const recibidos: Array<Record<string, unknown>> = [];
    await new Promise<void>((ok, mal) => {
      ws.on("message", (d, binario) => {
        const msg = (binario ? decodificarInicio(d as Buffer) : JSON.parse(String(d))) as Record<string, unknown>;
        recibidos.push(msg);
        if (msg.t === "estado" && recibidos.some((r) => r.t === "inicio") && recibidos.some((r) => r.t === "tribus")) ok();
      });
      ws.on("error", mal);
    });
    const estado = recibidos.find((r) => r.t === "estado")!;
    const colonos = estado.colonos as Array<{ id: string }>;
    assert.equal(colonos.length, 6);
    let rid = 0;
    const pedir = (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((ok) => {
      const mio = ++rid;
      const escuchar = (d: unknown) => {
        const msg = JSON.parse(String(d)) as Record<string, unknown>;
        if (msg.t === "respuesta" && msg.rid === mio) { ws.off("message", escuchar); ok(msg); }
      };
      ws.on("message", escuchar);
      ws.send(JSON.stringify({ ...cmd, rid: mio }));
    });
    const ficha = await pedir({ tipo: "ficha", id: colonos[0].id });
    assert.equal(ficha.ok, true);
    assert.ok(Array.isArray(ficha.rasgos) && (ficha.rasgos as unknown[]).length >= 2);
    const poder = await pedir({ tipo: "poder", poder: "lluvia" });
    assert.equal(poder.ok, true);
    const vel = await pedir({ tipo: "velocidad", valor: 2 });
    assert.equal(vel.velocidad, 2);
    ws.close();
  } finally {
    await vivo.cerrar();
  }
  const guardado = JSON.parse(await readFile(join(datos, "mundo.json"), "utf8"));
  assert.equal(guardado.datos.tribus.length, 2);
  assert.ok((await readFile(join(datos, "bitacora.jsonl"), "utf8")).includes("Nace "));
  await rm(datos, { recursive: true, force: true });
});
