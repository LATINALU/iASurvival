// Economía estilo AoE, edades, conquista y proyectiles (mapa chico para que corra rápido).
import { test } from "node:test";
import assert from "node:assert/strict";
import { generarMundo } from "../src/dominio/tribus.ts";
import { avanzar } from "../src/dominio/simulacion.ts";
import { CONFIG_POR_DEFECTO } from "../src/dominio/tipos.ts";
import type { Estructura, Tribu } from "../src/dominio/tipos.ts";
import type { Mundo } from "../src/dominio/mundo.ts";
import { ESTRUCTURAS } from "../src/dominio/catalogo.ts";
import { disparar } from "../src/dominio/fisica.ts";
import { era } from "../src/dominio/tecnologia.ts";

const mundo = (tribus = 2): Mundo => generarMundo({ ...CONFIG_POR_DEFECTO, tam: 576, semilla: 9, tribus, colonosPorTribu: 6 });
const obra = (m: Mundo, t: Tribu, tipo: string, dx: number, dz: number): Estructura => {
  const e: Estructura = { id: m.nuevoId("e"), tipo, tribu: t.id, x: t.centro.x + dx, z: t.centro.z + dz, rot: 0, progreso: 1, entregado: {}, vida: ESTRUCTURAS.get(tipo)!.vida, combustible: 0, cultivo: 0, ocupantes: [] };
  m.estructuras.set(e.id, e);
  return e;
};

test("hay yacimientos grandes y cada pueblo tiene una cantera cerca", () => {
  const m = mundo();
  const yac = [...m.nodos.values()].filter((n) => ["roca", "carbon", "cobre", "hierro", "oro", "azufre"].includes(n.tipo));
  assert.ok(yac.length >= 10);
  assert.ok(yac.every((n) => n.nodo.def.golpes >= 160 && n.nodo.def.reaparicion < 1e9), "los yacimientos son grandes y vuelven a producir");
  for (const t of m.tribus.values()) assert.ok(m.yacimientosCerca(t.centro.x, t.centro.z, 80, (n) => n.tipo === "roca").length > 0, `${t.nombre} sin cantera`);
});

test("cada recurso se entrega en el punto más cercano que lo recibe", () => {
  const m = mundo(1);
  const t = [...m.tribus.values()][0];
  const almacen = obra(m, t, "almacen", 0, 6);
  const mina = obra(m, t, "campamento_minero", 40, 0);
  assert.equal(m.entregaPara(t, t.centro.x + 42, t.centro.z, ["piedra"])?.id, mina.id);
  assert.equal(m.entregaPara(t, t.centro.x + 42, t.centro.z, ["bayas"])?.id, almacen.id, "un campamento minero no recibe comida");
});

test("el tope de población sale de las camas de las viviendas", () => {
  const m = mundo(1);
  const t = [...m.tribus.values()][0];
  for (const e of [...m.estructuras.values()]) if (e.tribu === t.id) m.estructuras.delete(e.id);
  assert.equal(m.capacidad(t), 8);
  for (let k = 0; k < 4; k++) obra(m, t, "choza", -20 + k * 8, 20);
  assert.equal(m.capacidad(t), 4 * (ESTRUCTURAS.get("choza")!.camas ?? 0));
});

test("se sube de edad con inventos, dos edificios de la edad y recursos (tarda un día)", () => {
  const m = mundo(1);
  const t = [...m.tribus.values()][0];
  t.conoce.push("agricultura", "carpinteria", "caza");
  obra(m, t, "centro", 20, 0);
  obra(m, t, "molino", -20, 0);
  t.almacen.bayas = 400; t.almacen.madera = 300;
  avanzar(m, Math.round(m.ticksDia * 0.25));
  assert.equal(era(t), 1);
  assert.ok(t.stats.avanceEdad !== undefined, "empezó el avance");
  avanzar(m, Math.round(m.ticksDia * 1.05));
  assert.equal(era(t), 2);
});

test("un pueblo sin defensores y con enemigos en la plaza es conquistado", () => {
  const m = mundo(2);
  const [a, b] = [...m.tribus.values()];
  a.relaciones[b.id] = -90; b.relaciones[a.id] = -90;
  const defensores = m.miembros(b.id);
  for (const c of defensores.slice(1)) { c.derribado = true; c.vida = 10; }
  for (const c of m.miembros(a.id).slice(0, 4)) { c.x = b.centro.x + 2; c.z = b.centro.z + 2; }
  const suyas = [...m.estructuras.values()].filter((e) => e.tribu === b.id).map((e) => e.id);
  avanzar(m, 120);
  assert.equal(b.extinta, true);
  assert.ok(defensores.every((c) => c.tribu === a.id), "la gente jura lealtad");
  assert.ok(suyas.every((id) => !m.estructuras.has(id) || m.estructuras.get(id)!.tribu === a.id), "las obras pasan al imperio");
});

test("una flecha vuela, puede dar al enemigo y desaparece", () => {
  const m = mundo(2);
  const [a, b] = [...m.tribus.values()];
  const tirador = m.miembros(a.id)[0], blanco = m.miembros(b.id)[0];
  blanco.x = tirador.x + 10; blanco.z = tirador.z;
  blanco.actividad = null;
  disparar(m, tirador, blanco.x, blanco.z, 30, "flecha");
  assert.equal(m.proyectiles.length, 1);
  for (let k = 0; k < 15 && m.proyectiles.length; k++) avanzar(m, 1);
  assert.equal(m.proyectiles.length, 0, "la flecha llegó o cayó");
});
