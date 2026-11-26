// Clima y entorno vivo: tiempo atmosférico por estación (despejado, nublado, lluvia, tormenta con rayos, nieve,
// niebla), incendios que se propagan por árboles y construcciones de madera, cultivos que crecen según la
// estación y la lluvia, fuegos que consumen leña, recursos que reaparecen, cuerpos que se pudren y fiebre que
// se contagia.

import { recordar } from "./animo.ts";
import { ESTRUCTURAS, NODOS } from "./catalogo.ts";
import { daniar } from "./colonos.ts";
import { HZ, dist, type Mundo } from "./mundo.ts";
import type { Clima, Nodo } from "./tipos.ts";

const PROB_CLIMA: Record<string, ReadonlyArray<readonly [Clima["tipo"], number]>> = {
  primavera: [["despejado", 4], ["nublado", 3], ["lluvia", 3], ["tormenta", 1], ["niebla", 1]],
  verano: [["despejado", 7], ["nublado", 2], ["lluvia", 1], ["tormenta", 1.5]],
  otoño: [["despejado", 3], ["nublado", 4], ["lluvia", 3], ["niebla", 2], ["tormenta", 0.5]],
  invierno: [["despejado", 3], ["nublado", 3], ["nieve", 4], ["niebla", 1]],
};

export function cambiarClima(m: Mundo, tipo: Clima["tipo"], duracionDias: number, anunciar = true): void {
  m.clima.tipo = tipo;
  m.clima.hasta = m.tick + Math.round(duracionDias * m.ticksDia);
  if (anunciar && tipo !== "despejado" && tipo !== "nublado") {
    const t: Record<string, string> = { lluvia: "Empieza a llover.", tormenta: "Se desata una tormenta.", nieve: "Empieza a nevar.", niebla: "La niebla cubre el valle." };
    m.emitir("clima", t[tipo] ?? tipo, { interes: tipo === "tormenta" ? 2 : 1, datos: { clima: tipo } });
  }
}

export const claveCelda = (x: number, z: number): string => `${Math.floor(x)},${Math.floor(z)}`;

export function prender(m: Mundo, x: number, z: number, intensidad = 1): void {
  const k = claveCelda(x, z);
  const f = m.incendios.get(k);
  if (f) f.intensidad = Math.max(f.intensidad, intensidad);
  else m.incendios.set(k, { x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5, intensidad });
}

export function caeRayo(m: Mundo, x: number, z: number, divino = false): void {
  for (const c of m.colonos.values()) {
    if (c.vivo && Math.hypot(c.x - x, c.z - z) < 2) daniar(m, c, 55, divino ? "divino" : "rayo");
  }
  for (const b of [...m.animales.values()]) if (Math.hypot(b.cuerpo.x - x, b.cuerpo.y - z) < 2) b.vida -= 60;
  prender(m, x, z, 1);
  m.emitir("rayo", divino ? "¡Un rayo cae del cielo despejado!" : "Un rayo cae sobre el bosque.", { x, z, interes: 2, datos: { divino } });
}

const indices = new WeakMap<Mundo, { n: number; mapa: Map<string, Nodo[]> }>();

/** Nodos por celda (para que el fuego no recorra todo el bosque). */
function nodosEn(m: Mundo, x: number, z: number): Nodo[] {
  let idx = indices.get(m);
  if (!idx || idx.n !== m.nodos.size) {
    const mapa = new Map<string, Nodo[]>();
    for (const n of m.nodos.values()) {
      const k = claveCelda(n.x, n.z);
      (mapa.get(k) ?? mapa.set(k, []).get(k)!).push(n);
    }
    idx = { n: m.nodos.size, mapa };
    indices.set(m, idx);
  }
  return idx.mapa.get(claveCelda(x, z)) ?? [];
}

function incendios(m: Mundo): void {
  // Cada segundo: los fuegos queman lo que hay en su celda y se propagan a celdas con árboles o madera.
  const lluvia = m.lloviendo ? 0.25 : m.clima.tipo === "nieve" ? 0.3 : 0;
  const seco = m.sequia ? 1.8 : m.estacion === "verano" ? 1.3 : 1;
  const nuevos: Array<[number, number]> = [];
  for (const [k, f] of m.incendios) {
    f.intensidad -= lluvia + 0.05;
    // Quema nodos inflamables y estructuras de madera.
    let combustible = false;
    for (const n of nodosEn(m, f.x, f.z)) {
      if (n.quemado || !NODOS.get(n.tipo)!.arde) continue;
      combustible = true;
      if (m.azar.prob(0.15)) {
        n.quemado = true;
        n.nodo.restantes = 0;
        n.espera = n.nodo.def.reaparicion * 3;
        m.nodosCambiados.add(n.id);
      }
    }
    for (const e of m.estructuras.values()) {
      const def = ESTRUCTURAS.get(e.tipo)!;
      if (!def.arde || Math.hypot(e.x - f.x, e.z - f.z) > def.radio + 0.5) continue;
      combustible = true;
      e.vida -= 4 * f.intensidad;
      if (e.vida <= 0) {
        m.quitarEstructura(e.id);
        const t = e.tribu ? m.tribus.get(e.tribu) : undefined;
        m.emitir("destruida", `El fuego destruye ${def.nombre === "choza" || def.nombre === "casa de piedra" ? "una" : "un"} ${def.nombre}${t ? ` de ${t.nombre}` : ""}.`, { x: e.x, z: e.z, interes: 2, tribu: e.tribu ?? undefined });
        if (t) for (const c of m.miembros(t.id)) recordar(m, c, "incendio", -5, `El fuego destruyó nuestro ${def.nombre}`, 1.5);
      }
    }
    if (!combustible) f.intensidad -= 0.2;
    if (f.intensidad <= 0) {
      m.incendios.delete(k);
      continue;
    }
    if (combustible && m.incendios.size < 400) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (m.azar.prob(0.12 * f.intensidad * seco * (lluvia ? 0.2 : 1))) nuevos.push([f.x + dx, f.z + dz]);
      }
    }
  }
  for (const [x, z] of nuevos) {
    const k = claveCelda(x, z);
    if (m.incendios.has(k)) continue;
    const hay = nodosEn(m, x, z).some((n) => !n.quemado && NODOS.get(n.tipo)!.arde)
      || [...m.estructuras.values()].some((e) => ESTRUCTURAS.get(e.tipo)!.arde && Math.hypot(e.x - x, e.z - z) < ESTRUCTURAS.get(e.tipo)!.radio + 0.5);
    if (hay) prender(m, x, z, 0.8);
  }
}

/** Sistema de clima y entorno. */
export function sistemaClima(m: Mundo, dt: number): void {
  // Tiempo atmosférico.
  if (m.tick >= m.clima.hasta) {
    const tabla = PROB_CLIMA[m.estacion];
    const peso = (t: string, p: number): number => (m.sequia && (t === "lluvia" || t === "tormenta") ? p * 0.1 : p);
    let r = m.azar.siguiente() * tabla.reduce((s, [t, p]) => s + peso(t, p), 0);
    let tipo: Clima["tipo"] = "despejado";
    for (const [t, p] of tabla) {
      r -= peso(t, p);
      if (r <= 0) { tipo = t; break; }
    }
    cambiarClima(m, tipo, m.azar.rango(0.12, 0.45), tipo !== m.clima.tipo);
  }
  if (m.clima.tipo === "tormenta" && m.azar.prob(dt / 90)) {
    const p = m.lugarLibre();
    caeRayo(m, p.x, p.z);
  }
  // Fuegos de las fogatas consumen leña.
  for (const e of m.estructuras.values()) {
    if (e.progreso < 1) continue;
    const def = ESTRUCTURAS.get(e.tipo)!;
    if (def.fuego && e.combustible > 0 && e.tipo === "fogata") {
      e.combustible -= dt * (m.lloviendo ? 1.6 : 1);
      if (e.combustible <= 0) { e.combustible = 0; m.emitir("fuego_apagado", `Se apagó la fogata${e.tribu ? ` de ${m.tribus.get(e.tribu)?.nombre ?? ""}` : ""}.`, { x: e.x, z: e.z, interes: 0, tribu: e.tribu ?? undefined }); }
    }
    // Cultivos.
    if (e.tipo === "huerto" && e.cultivo > 0 && e.cultivo < 1) {
      const ritmo = m.estacion === "invierno" ? -0.5 : m.estacion === "verano" ? 1.2 : m.estacion === "otoño" ? 0.7 : 1;
      const agua = m.lloviendo ? 1.5 : m.sequia ? 0.4 : 1;
      e.cultivo = Math.max(0, Math.min(1, e.cultivo + (dt / (m.ticksDia / HZ)) * 0.9 * ritmo * agua));
      if (m.temperaturaEn(e.x, e.z) < -2 && m.azar.prob(dt / 60)) {
        e.cultivo = 0;
        m.emitir("helada", "La helada arruina un huerto.", { x: e.x, z: e.z, interes: 1, tribu: e.tribu ?? undefined });
      }
    }
  }
  // Recursos que reaparecen (cada segundo).
  if (m.tick % HZ === 0) {
    for (const id of m.agotados) {
      const n = m.nodos.get(id);
      if (!n || (n.nodo.disponible && !n.quemado)) { m.agotados.delete(id); continue; }
      n.espera -= 1;
      if (n.espera <= 0) {
        n.nodo.restantes = n.nodo.def.golpes;
        n.quemado = false;
        m.nodosCambiados.add(n.id);
        m.agotados.delete(n.id);
      }
    }
    incendios(m);
    for (const [id, k] of m.cuerpos) if (m.tick >= k.expira) m.cuerpos.delete(id);
    // Contagio de fiebre.
    for (const c of m.colonos.values()) {
      if (!c.vivo || !c.enfermedad || c.enfermedad.severidad < 0.2) continue;
      for (const o of m.colonos.values()) if (o.vivo && !o.enfermedad && o.id !== c.id && dist(o, c) < 2.5 && m.azar.prob(0.004)) {
        o.enfermedad = { severidad: 0.15, inmunidad: 0 };
        m.emitir("contagio", `${o.nombre} se contagia de fiebre.`, { x: o.x, z: o.z, actores: [o.id], interes: 1, tribu: o.tribu });
      }
    }
  }
}
