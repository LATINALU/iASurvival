// Reglas del mundo de colonias: generación, rasgos que cambian conductas, ánimo, planificador, poderes de dios,
// guardado ida y vuelta y determinismo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { recordar } from "../src/dominio/animo.ts";
import { crearColono, gusto, stat, matar } from "../src/dominio/colonos.ts";
import { RASGO_POR_ID } from "../src/dominio/datos/rasgos.ts";
import type { Mundo } from "../src/dominio/mundo.ts";
import { usarPoder } from "../src/dominio/poderes.ts";
import { exportarMundo, importarMundo } from "../src/dominio/serializacion.ts";
import { avanzar } from "../src/dominio/simulacion.ts";
import { generarMundo, estado } from "../src/dominio/tribus.ts";
import { CONFIG_POR_DEFECTO, type Colono } from "../src/dominio/tipos.ts";
import { simularColonias } from "../herramientas/simular.ts";

const mundo = (semilla = 3): Mundo => generarMundo({ ...CONFIG_POR_DEFECTO, semilla, tribus: 3, colonosPorTribu: 4 });

function conRasgos(m: Mundo, rasgos: string[]): Colono {
  const t = [...m.tribus.values()][0];
  const c = crearColono(m, { tribu: t.id, x: t.centro.x, z: t.centro.z });
  c.rasgos.splice(0, c.rasgos.length, ...rasgos);
  return c;
}

test("el mundo nace con tribus, colonos con 2-4 rasgos compatibles y una fogata planeada", () => {
  const m = mundo();
  assert.equal(m.tribus.size, 3);
  assert.equal(m.vivos().length, 12);
  for (const c of m.vivos()) {
    assert.ok(c.rasgos.length >= 2 && c.rasgos.length <= 4, `${c.nombre}: ${c.rasgos}`);
    for (const r of c.rasgos) for (const o of c.rasgos) assert.ok(!RASGO_POR_ID.get(r)!.incompatibles?.includes(o), `${r} vs ${o}`);
  }
  for (const t of m.tribus.values()) assert.ok([...m.estructuras.values()].some((e) => e.tribu === t.id && e.tipo === "fogata"));
});

test("los rasgos cambian estadísticas y gustos de trabajo", () => {
  const m = mundo();
  const fuerte = conRasgos(m, ["fuerte", "veloz"]);
  assert.ok(stat(fuerte, "fuerza") > 1.3 && stat(fuerte, "velocidad") > 1.2);
  const veg = conRasgos(m, ["vegetariano", "pacifista"]);
  // Los gustos se calculan al nacer: un colono nuevo con esos rasgos no caza ni pelea.
  const t = [...m.tribus.values()][0];
  let paz: Colono | null = null;
  for (let i = 0; i < 400 && !paz; i++) {
    const c = crearColono(m, { tribu: t.id, x: t.centro.x, z: t.centro.z });
    if (c.rasgos.includes("pacifista")) paz = c;
  }
  assert.ok(paz, "no salió ningún pacifista en 400 nacimientos");
  assert.equal(gusto(paz!, "pelear"), 0);
  assert.ok(veg.rasgos.includes("vegetariano"));
});

test("los rasgos amplifican o invierten los recuerdos", () => {
  const m = mundo();
  const sensible = conRasgos(m, ["sensible"]);
  const sanguinario = conRasgos(m, ["sanguinario"]);
  recordar(m, sensible, "muerte_vista", -5, "vi morir a alguien", 1);
  recordar(m, sanguinario, "muerte_vista", -5, "vi morir a alguien", 1);
  assert.ok(sensible.pensamientos[0].valor < -6);
  assert.ok(sanguinario.pensamientos[0].valor > 0, "al sanguinario le gusta");
});

test("la muerte deja duelo en la familia y un cuerpo resucitable", () => {
  const m = mundo();
  const [a, b] = m.vivos();
  a.pareja = b.id;
  b.pareja = a.id;
  a.ultimoDanio = "lobo";
  matar(m, a);
  assert.equal(a.vivo, false);
  assert.ok(b.pensamientos.some((p) => p.id.startsWith("muerte_familiar")));
  const cuerpo = [...m.cuerpos.values()].find((k) => k.colono === a.id)!;
  assert.ok(usarPoder(m, "resucitar", { objetivo: cuerpo.id }).ok);
  assert.equal(a.vivo, true);
});

test("en medio día cada tribu levanta su fogata y trabaja el tablero", () => {
  const m = mundo(5);
  const iniciales = [...m.tribus.keys()];
  avanzar(m, Math.round(m.ticksDia * 0.5));
  for (const t of [...m.tribus.values()].filter((x) => iniciales.includes(x.id))) {
    const fogata = [...m.estructuras.values()].find((e) => e.tribu === t.id && e.tipo === "fogata");
    assert.ok(fogata && fogata.progreso >= 1, `${t.nombre} sin fogata`);
    const entregada = [...m.estructuras.values()].filter((e) => e.tribu === t.id && e.progreso < 1).reduce((s2, e) => s2 + (e.entregado.madera ?? 0), 0);
    assert.ok((t.almacen.madera ?? 0) + entregada + [...m.estructuras.values()].filter((e) => e.tribu === t.id && e.progreso >= 1).length >= 3, `${t.nombre} no trabajó`);
  }
});

test("poderes: rayo hiere, regalo llena el almacén, discordia declara la guerra", () => {
  const m = mundo();
  const c = m.vivos()[0];
  const vida = c.vida;
  assert.ok(usarPoder(m, "rayo", { x: c.x, z: c.z }).ok);
  assert.ok(c.vida < vida);
  const t = m.tribus.get(c.tribu)!;
  const madera = t.almacen.madera ?? 0;
  assert.ok(usarPoder(m, "regalo", { x: t.centro.x, z: t.centro.z }).ok);
  assert.ok((t.almacen.madera ?? 0) >= madera + 40);
  assert.ok(usarPoder(m, "discordia", { x: t.centro.x, z: t.centro.z }).ok);
  assert.ok(Object.values(t.relaciones).some((v) => estado(v) === "guerra"));
  assert.equal(usarPoder(m, "inexistente", {}).ok, false);
});

test("guardar y cargar continúa exactamente igual", () => {
  const m = mundo(7);
  avanzar(m, 600);
  const m2 = importarMundo(JSON.parse(JSON.stringify(exportarMundo(m))));
  avanzar(m, 400);
  avanzar(m2, 400);
  assert.equal(JSON.stringify(exportarMundo(m2).colonos.map((c) => [c.x, c.z, c.vida])), JSON.stringify(exportarMundo(m).colonos.map((c) => [c.x, c.z, c.vida])));
});

test("determinismo: misma semilla, mismo informe", () => {
  const a = simularColonias({ dias: 0.15, tribus: 2, colonos: 3, semilla: 9 });
  const b = simularColonias({ dias: 0.15, tribus: 2, colonos: 3, semilla: 9 });
  assert.deepEqual({ ...a, segundosReales: 0 }, { ...b, segundosReales: 0 });
});
