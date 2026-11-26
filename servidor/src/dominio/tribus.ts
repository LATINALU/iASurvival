// Tribus: generación del mundo (recursos, tribus, colonos fundadores, fauna), líder, diplomacia entre tribus
// (paz, tensión, guerra, alianza) que cambia con la vecindad, el carácter de los líderes, los robos, las
// muertes y el comercio; incursiones de guerra, caravanas de comercio y viajeros que se unen.

import { recordar } from "./animo.ts";
import { MINERALES, NODOS, VARIANTES_ARBOL, YACIMIENTOS, esYacimiento } from "./catalogo.ts";
import { crearColono, destreza, tiene } from "./colonos.ts";
import { crearAnimal } from "./fauna.ts";
import { HZ, dist, Mundo } from "./mundo.ts";
import { colocarPlano, comidaDe, estructurasDe, trazarCalles } from "./planificador.ts";
import { aguaMasCercana, biomaEn, caminable } from "./terreno.ts";
import { NUCLEOS_TRIBU, RANGOS, SIMBOLOS } from "./datos/trasfondos.ts";
import { mundo, supervivencia } from "txnucleo";
import { campoFbmNativo } from "./nativo.ts";
import type { ConfigMundo, Tarea, Tribu } from "./tipos.ts";
import { INICIALES, era } from "./tecnologia.ts";

export type EstadoDiplomatico = "alianza" | "paz" | "tension" | "guerra";

export function estado(valor: number): EstadoDiplomatico {
  return valor <= -60 ? "guerra" : valor <= -20 ? "tension" : valor >= 45 ? "alianza" : "paz";
}

// ------------------------------------------------------------ generación

export function crearNodo(m: Mundo, tipo: string, variante: string, x: number, z: number, id = m.nuevoId("n")): void {
  m.nodos.set(id, { id, tipo, variante, x, z, nodo: new supervivencia.NodoRecoleccion(NODOS.get(tipo)!.def), espera: 0, quemado: false });
  m.nodosNuevos.add(id);
}

/** Recursos del mundo:
 *  - BOSQUES en manchas (ruido de baja frecuencia) con claros: allí se fundan las ciudades;
 *  - arbustos de bayas y hierbas en PARCHES;
 *  - YACIMIENTOS repartidos con distancia mínima (canteras, carbón, cobre, hierro, oro, azufre). */
function poblarNodos(m: Mundo): void {
  const t = m.terreno;
  const s = m.config.semilla;
  // [umbral de bosque, densidad dentro del bosque, densidad suelta] por bioma.
  const bosque: Record<string, readonly [number, number, number]> = {
    denso: [0.4, 0.16, 0.01], bosque: [0.5, 0.11, 0.006], pradera: [0.66, 0.08, 0.002], taiga: [0.48, 0.12, 0.006],
    selva: [0.38, 0.17, 0.012], pantano: [0.55, 0.07, 0.006], sabana: [0.7, 0.05, 0.003], nieve: [0.68, 0.05, 0.002],
    roca: [0.75, 0.04, 0.001], desierto: [0.8, 0.02, 0.0015], arena: [0.8, 0.03, 0.002],
  };
  const manchas = campoFbmNativo(t.tam, 110, 13, 7, s + 41, 3);
  const parches = campoFbmNativo(t.tam, 38, 3, 91, s + 43, 2);
  for (let z = 2; z < t.tam - 2; z++) {
    for (let x = 2; x < t.tam - 2; x++) {
      const b = biomaEn(t, x, z);
      const p = bosque[b];
      if (!p) continue;
      const mancha = manchas ? manchas[z * t.tam + x] : mundo.fbm(x / 110 + 13, z / 110 + 7, { semilla: s + 41, octavas: 3 });
      const r = m.azar.siguiente();
      let tipo: string | null = null;
      if (r < (mancha > p[0] ? p[1] * 0.75 * Math.min(1, (mancha - p[0]) * 8) : p[2])) tipo = "arbol";
      else {
        const parche = parches ? parches[z * t.tam + x] : mundo.fbm(x / 38 + 3, z / 38 + 91, { semilla: s + 43, octavas: 2 });
        if (parche > 0.66 && !["nieve", "roca", "desierto"].includes(b)) {
          const r2 = m.azar.siguiente();
          if (r2 < 0.05) tipo = "arbusto";
          else if (r2 < 0.1) tipo = "hierbas";
        }
      }
      if (!tipo) continue;
      const vars = tipo === "arbol" ? VARIANTES_ARBOL[b] ?? VARIANTES_ARBOL.bosque : [tipo];
      crearNodo(m, tipo, vars[Math.floor(m.azar.siguiente() * vars.length)], x + m.azar.rango(0.2, 0.8), z + m.azar.rango(0.2, 0.8));
    }
  }
  // Yacimientos con distancia mínima entre ellos.
  const puestos: Array<{ x: number; z: number; tipo: string; radio: number }> = [];
  const area = t.tam * t.tam;
  for (const [tipo, y] of Object.entries(YACIMIENTOS)) {
    const meta = Math.max(2, Math.round(area / y.cada));
    const biomasOk = tipo === "roca" ? null : MINERALES[tipo].biomas;
    let hechos = 0;
    for (let intento = 0; intento < meta * 60 && hechos < meta; intento++) {
      const x = m.azar.rango(12, t.tam - 12), z = m.azar.rango(12, t.tam - 12);
      const b = biomaEn(t, x, z);
      if (b === "agua" || (biomasOk && !biomasOk.includes(b) && m.azar.prob(0.85))) continue;
      if (tipo === "roca" && b !== "roca" && m.azar.prob(0.35)) continue;
      let ok = true;
      for (let dz = -4; dz <= 4 && ok; dz++) for (let dx = -4; dx <= 4 && ok; dx++) if (biomaEn(t, x + dx, z + dz) === "agua") ok = false;
      if (!ok || puestos.some((p) => Math.hypot(p.x - x, p.z - z) < 38)) continue;
      puestos.push({ x, z, tipo, radio: y.radio });
      hechos++;
    }
  }
  // En lote: despeja los árboles encima de cada yacimiento y lo crea (un solo índice espacial).
  for (const p of puestos) for (const n of m.nodosCerca(p.x, p.z, p.radio + 1.5)) m.nodos.delete(n.id);
  for (const p of puestos) crearNodo(m, p.tipo, p.tipo, p.x, p.z);
}

function nombreTribu(m: Mundo, usados: Set<string>): { nucleo: string; nombre: string; simbolo: string } {
  const libres = NUCLEOS_TRIBU.filter((n) => !usados.has(n));
  const nucleo = (libres.length ? libres : NUCLEOS_TRIBU)[Math.floor(m.azar.siguiente() * (libres.length || NUCLEOS_TRIBU.length))];
  const titulos = RANGOS[0].titulos;
  const titulo = titulos[Math.floor(m.azar.siguiente() * titulos.length)];
  const simbolo = SIMBOLOS.find((x) => nucleo.toLowerCase().includes(x)) ?? SIMBOLOS[Math.floor(m.azar.siguiente() * SIMBOLOS.length)];
  return { nucleo, nombre: `${titulo} ${nucleo}`, simbolo };
}

/** Sube de rango (Clan → Aldea → Señorío → Reino → Imperio) según población y era. */
function actualizarRango(m: Mundo, t: Tribu): void {
  const pob = m.miembros(t.id).length;
  const e = era(t);
  let r = 0;
  RANGOS.forEach((x, k) => { if (pob >= x.minPoblacion && e >= x.minEra) r = k; });
  if (r <= t.rango) return;
  const antes = t.nombre;
  t.rango = r;
  const titulos = RANGOS[r].titulos;
  t.nombre = `${titulos[Math.floor(m.azar.siguiente() * titulos.length)]} ${t.nucleo}`;
  m.emitir("rango", `¡${antes} se proclama ${t.nombre}!`, { x: t.centro.x, z: t.centro.z, interes: 3, tribu: t.id });
}

const COLORES = [0.0, 0.58, 0.13, 0.78, 0.33, 0.9, 0.46, 0.07, 0.68, 0.22, 0.52, 0.85, 0.27, 0.95, 0.4, 0.62];

/** Lugar para fundar: tierra firme, cerca del agua, lejos de otras tribus (o a cierta distancia de `cerca`). */
export function lugarFundacion(m: Mundo, otras: Tribu[], cerca?: { x: number; z: number; min: number; max: number }): { x: number; z: number } | null {
  let mejor: { x: number; z: number } | null = null, mp = -Infinity;
  for (let i = 0; i < 500; i++) {
    const p = cerca ? m.lugarLibre({ cerca, radio: cerca.max, biomas: ["pradera", "bosque", "sabana", "taiga", "denso", "selva"] }) : m.lugarLibre({ biomas: ["pradera", "bosque", "sabana", "taiga"] });
    if (cerca && Math.hypot(p.x - cerca.x, p.z - cerca.z) < cerca.min) continue;
    if (Math.min(p.x, p.z, m.config.tam - p.x, m.config.tam - p.z) < 30) continue;
    const agua = aguaMasCercana(m.terreno, p.x, p.z, 30);
    if (!agua || agua.distancia < 8) continue;
    const lejania = otras.length ? Math.min(...otras.filter((o) => !o.extinta).map((o) => dist(o.centro, p))) : 200;
    if (lejania < 55) continue;
    let libres = 0;
    for (let dz = -14; dz <= 14; dz += 2) for (let dx = -14; dx <= 14; dx += 2) {
      const b = biomaEn(m.terreno, p.x + dx, p.z + dz);
      if (["pradera", "bosque", "sabana", "taiga"].includes(b) && m.terreno.alturas[Math.floor(p.z + dz) * m.config.tam + Math.floor(p.x + dx)] < 2.1) libres++;
    }
    const yac = m.yacimientosCerca(p.x, p.z, 90);
    if (yac.some((n) => Math.hypot(n.x - p.x, n.z - p.z) < 16)) continue;
    const dCantera = Math.min(999, ...yac.filter((n) => n.tipo === "roca").map((n) => Math.hypot(n.x - p.x, n.z - p.z)));
    const cantera = dCantera < 70 ? 40 - dCantera * 0.3 : -40;
    // Un claro (pocos árboles a menos de 18 m) con bosque alrededor (20–60 m): leña cerca sin vivir dentro del bosque.
    const claro = m.nodosCerca(p.x, p.z, 18, (n) => n.tipo === "arbol").length;
    const madera = m.nodosCerca(p.x, p.z, 60, (n) => n.tipo === "arbol").length - claro;
    if (claro > 30) continue;
    const puntaje = Math.min(lejania, 140) * (cerca ? 0.3 : 2) - agua.distancia * 0.5 + libres * 1.5 + cantera + Math.min(madera, 220) * 0.1 - claro * 1.2;
    if (puntaje > mp) { mp = puntaje; mejor = p; }
  }
  return mejor;
}

/** Funda una tribu en `centro`. */
export function fundarTribu(m: Mundo, centro: { x: number; z: number }, origen: Tribu | null, almacen: Record<string, number>): Tribu {
  const usados = new Set([...m.tribus.values()].map((t) => t.nucleo));
  const { nombre, simbolo, nucleo } = nombreTribu(m, usados);
  const t: Tribu = {
    id: m.nuevoId("T"), nombre, nucleo, rango: 0, color: COLORES[m.tribus.size % COLORES.length], simbolo, centro, almacen,
    relaciones: {}, lider: null, extinta: false, fundada: m.tick, ultimaIncursion: -1e9, ultimaCaravana: -1e9,
    conoce: origen ? [...origen.conoce] : [...INICIALES], investigando: null, conocimiento: 0, origen: origen?.id ?? null,
    giro: m.azar.rango(0, Math.PI / 2), radioMuro: 18, stats: {}, edad: origen?.edad ?? 1,
  };
  if (!m.yacimientosCerca(centro.x, centro.z, 75, (n) => n.tipo === "roca").length) {
    for (let k = 0; k < 40; k++) {
      const a = m.azar.siguiente() * Math.PI * 2, r = m.azar.rango(28, 48);
      const x = centro.x + Math.cos(a) * r, z = centro.z + Math.sin(a) * r;
      let ok = true;
      for (let dz = -4; dz <= 4 && ok; dz++) for (let dx = -4; dx <= 4 && ok; dx++) if (!caminable(m.terreno, Math.floor(x + dx), Math.floor(z + dz))) ok = false;
      if (!ok) continue;
      for (const n of m.nodosCerca(x, z, 4)) m.nodos.delete(n.id);
      crearNodo(m, "roca", "roca", x, z);
      m.hornearYacimientos();
      break;
    }
  }
  for (const n of m.nodosCerca(centro.x, centro.z, 10)) { if (esYacimiento(n.tipo)) continue; n.nodo.restantes = 0; n.espera = 1e9; m.nodosCambiados.add(n.id); }
  for (const o of m.tribus.values()) {
    if (o.extinta) continue;
    t.relaciones[o.id] = Math.round(m.azar.rango(-10, 10));
    o.relaciones[t.id] = t.relaciones[o.id];
  }
  m.tribus.set(t.id, t);
  trazarCalles(m, t);
  colocarPlano(m, t, "fogata");
  return t;
}

/** Crea un mundo nuevo: empieza con un solo pueblo (o con `config.tribus`). */
export function generarMundo(config: ConfigMundo): Mundo {
  const m = new Mundo(config);
  poblarNodos(m);
  m.hornearYacimientos();
  const tribus: Tribu[] = [];
  for (let i = 0; i < config.tribus; i++) {
    const centro = lugarFundacion(m, tribus) ?? m.lugarLibre({ biomas: ["pradera", "bosque"] });
    const t = fundarTribu(m, centro, null, { madera: 24, piedra: 10, bayas: 30, fibra: 10, carne_asada: 6 });
    tribus.push(t);
    for (let k = 0; k < config.colonosPorTribu; k++) {
      const p = m.lugarLibre({ cerca: centro, radio: 4 });
      crearColono(m, { tribu: t.id, x: p.x, z: p.z });
    }
    elegirLider(m, t);
    m.emitir("fundacion", `Nace ${t.nombre}.`, { x: centro.x, z: centro.z, interes: 2, tribu: t.id });
  }
  const inicial = Math.round(160 * Math.max(1, ((config.tam / 576) ** 2) * 0.55));
  for (let i = 0; i < inicial; i++) {
    const especie = i < inicial * 0.5 ? "conejo" : i < inicial * 0.81 ? "ciervo" : "jabali";
    const l = m.lugarLibre({ evitar: tribus.map((t) => t.centro), minDist: 30 });
    crearAnimal(m, especie, l.x, l.z);
  }
  m.nodosNuevos.clear();
  return m;
}

/** CISMA: alguien ambicioso, rebelde o aventurero se va con sus seguidores a fundar su propio pueblo. */
function cisma(m: Mundo, t: Tribu): boolean {
  const miembros = m.miembros(t.id);
  const adultos = miembros.filter((c) => !m.esNino(c));
  if (adultos.length < 14 || m.tick - t.fundada < m.ticksAnio) return false;
  const lider = t.lider ? m.colonos.get(t.lider) : undefined;
  const candidatos = adultos.filter((c) => c.id !== t.lider && !c.derribado && !c.crisis).map((c) => {
    let p = 0;
    if (tiene(c, "lider")) p += 2;
    if (tiene(c, "nomada")) p += 1.5;
    if (tiene(c, "rebelde")) p += 2;
    if (tiene(c, "belicoso")) p += 1.5;
    if (tiene(c, "visionario")) p += 1.5;
    if (lider && c.memoria.relacion(lider.id) < -20) p += 2;
    if (c.animo < 35) p += 1;
    p += Math.max(0, c.personalidad.impulsivo) + Math.max(0, -c.personalidad.sociable) * 0.5;
    return { c, p };
  }).filter((x) => x.p >= 1.5).sort((a, b) => b.p - a.p);
  if (!candidatos.length) return false;
  const fundador = candidatos[0].c;
  // Seguidores: pareja, hijos, amigos del fundador y descontentos (hasta ~40 % del pueblo).
  const max = Math.max(2, Math.floor(miembros.length * 0.4));
  const seguidores = miembros.filter((o) => o.id !== fundador.id && o.id !== t.lider && (
    o.id === fundador.pareja || fundador.hijos.includes(o.id) || o.padres.includes(fundador.id) || o.memoria.relacion(fundador.id) > 30 ||
    (lider && o.memoria.relacion(lider.id) < -25)
  )).slice(0, max);
  if (seguidores.length < 2) return false;
  const lugar = lugarFundacion(m, [...m.tribus.values()], { x: t.centro.x, z: t.centro.z, min: 70, max: 170 });
  if (!lugar) return false;
  // Se llevan una parte del almacén.
  const parte = (seguidores.length + 1) / miembros.length;
  const almacen: Record<string, number> = {};
  for (const [o, n] of Object.entries(t.almacen)) {
    const lleva = Math.floor(n * parte * 0.8);
    if (lleva > 0) { almacen[o] = lleva; m.sacar(t, o, lleva); }
  }
  const nueva = fundarTribu(m, lugar, t, almacen);
  const rebelde = tiene(fundador, "rebelde") || (lider && fundador.memoria.relacion(lider.id) < -20);
  t.relaciones[nueva.id] = nueva.relaciones[t.id] = rebelde ? -40 : 25;
  for (const c of [fundador, ...seguidores]) {
    for (const ta of m.tareas.values()) if (ta.asignado === c.id) ta.asignado = null;
    if (c.cama) { const cama = m.estructuras.get(c.cama); if (cama) cama.ocupantes = cama.ocupantes.filter((i) => i !== c.id); c.cama = null; }
    c.tribu = nueva.id;
    c.actividad = null;
    c.dormido = false;
    c.proximaDecision = m.tick + HZ * 2;
  }
  // Caminan juntos hacia su nueva tierra.
  for (const c of [fundador, ...seguidores]) c.actividad = { tipo: "ir", destino: { x: lugar.x + m.azar.rango(-3, 3), z: lugar.z + m.azar.rango(-3, 3), alcance: 2 }, camino: [], restante: 0, hechas: 0, recalculo: -999, inicio: m.tick, datos: {} };
  nueva.lider = fundador.id;
  m.emitir("cisma", rebelde
    ? `¡${fundador.nombre} se rebela contra ${t.nombre}! Se marcha con ${seguidores.length} seguidores y funda ${nueva.nombre}.`
    : `${fundador.nombre} parte de ${t.nombre} con ${seguidores.length} personas para fundar ${nueva.nombre}.`,
  { x: t.centro.x, z: t.centro.z, actores: [fundador.id, ...seguidores.map((s) => s.id)], interes: 3, tribu: nueva.id, datos: { de: t.id, a: nueva.id } });
  return true;
}

/** Viajeros que llegan al valle: unos se unen a un pueblo, otros fundan el suyo. */
export function llegaViajero(m: Mundo, t?: Tribu): void {
  const vivas = [...m.tribus.values()].filter((x) => !x.extinta);
  const buenTiempo = m.estacion === "primavera" || m.estacion === "verano";
  const fundar = !t && buenTiempo && (vivas.length < 2 || m.azar.prob(0.3)) && vivas.length < 14;
  if (fundar) {
    const lugar = lugarFundacion(m, vivas);
    if (lugar) {
      const nueva = fundarTribu(m, lugar, null, { madera: 24, piedra: 8, bayas: 30, carne_asada: 8, fibra: 6 });
      // Comparten saberes de su tierra lejana.
      if (m.azar.prob(0.5)) nueva.conoce.push(["caza", "carpinteria", "agricultura", "hierbas"][Math.floor(m.azar.siguiente() * 4)]);
      const n = 3 + Math.floor(m.azar.siguiente() * 3);
      const gente = Array.from({ length: n }, () => { const p = m.lugarLibre({ cerca: lugar, radio: 4 }); return crearColono(m, { tribu: nueva.id, x: p.x, z: p.z }); });
      elegirLider(m, nueva);
      m.emitir("llegada", `Un grupo de ${n} viajeros llega de tierras lejanas y funda ${nueva.nombre}.`, { x: lugar.x, z: lugar.z, actores: gente.map((g) => g.id), interes: 3, tribu: nueva.id });
      return;
    }
  }
  const destino = t ?? vivas[Math.floor(m.azar.siguiente() * vivas.length)];
  if (!destino) return;
  const borde = m.lugarLibre({ cerca: destino.centro, radio: 45, evitar: [destino.centro], minDist: 30 });
  const c = crearColono(m, { tribu: destino.id, x: borde.x, z: borde.z });
  const acepta = m.miembros(destino.id).length < m.capacidad(destino) && (comidaDe(destino) > m.miembros(destino.id).length * 25 || m.azar.prob(0.6));
  if (acepta) {
    m.emitir("viajero", `${c.nombre}, un viajero, se une a ${destino.nombre}.`, { x: c.x, z: c.z, actores: [c.id], interes: 2, tribu: destino.id });
  } else {
    m.colonos.delete(c.id);
    m.emitir("viajero", `${destino.nombre} rechaza a un viajero hambriento.`, { x: c.x, z: c.z, interes: 1, tribu: destino.id });
  }
}

// ------------------------------------------------------------ líder y diplomacia

export function elegirLider(m: Mundo, t: Tribu): void {
  const candidatos = m.miembros(t.id).filter((c) => !m.esNino(c));
  if (!candidatos.length) return;
  const puntaje = (c: (typeof candidatos)[number]): number =>
    destreza(c, "social") * 2 + m.edad(c) / 30 + (tiene(c, "lider") ? 3 : 0) + c.personalidad.sociable + c.personalidad.valiente * 0.5;
  const nuevo = candidatos.sort((a, b) => puntaje(b) - puntaje(a))[0];
  if (t.lider !== nuevo.id) {
    const habia = !!t.lider;
    t.lider = nuevo.id;
    if (habia || m.tick > 0) m.emitir("lider", `${nuevo.nombre} es ahora quien guía a ${t.nombre}.`, { x: nuevo.x, z: nuevo.z, actores: [nuevo.id], interes: 2, tribu: t.id });
  }
}

/** Carácter de una tribu según su líder (belicosa, comerciante). */
export function caracter(m: Mundo, t: Tribu): { belicosa: number; comerciante: number } {
  const l = t.lider ? m.colonos.get(t.lider) : undefined;
  if (!l) return { belicosa: 0, comerciante: 0 };
  return {
    belicosa: (tiene(l, "belicoso") ? 1 : 0) + (tiene(l, "sanguinario") ? 0.5 : 0) + l.personalidad.impulsivo * 0.4 - (tiene(l, "pacifista") ? 1.5 : 0) - l.personalidad.empatico * 0.3,
    comerciante: (tiene(l, "lider") ? 0.3 : 0) + l.personalidad.sociable * 0.5 + destreza(l, "social") * 0.3 + (tiene(l, "visionario") ? 0.4 : 0),
  };
}

function cambiarRelacion(m: Mundo, a: Tribu, b: Tribu, delta: number, motivo?: string): void {
  const antes = estado(a.relaciones[b.id] ?? 0);
  a.relaciones[b.id] = Math.max(-100, Math.min(100, (a.relaciones[b.id] ?? 0) + delta));
  const despues = estado(a.relaciones[b.id]);
  if (antes !== despues) {
    const t: Record<EstadoDiplomatico, string> = { guerra: `¡${a.nombre} declara la guerra a ${b.nombre}!`, tension: `Crece la tensión entre ${a.nombre} y ${b.nombre}.`, paz: `${a.nombre} y ${b.nombre} hacen las paces.`, alianza: `${a.nombre} y ${b.nombre} sellan una alianza.` };
    m.emitir("diplomacia", t[despues] + (motivo ? ` (${motivo})` : ""), { x: a.centro.x, z: a.centro.z, interes: despues === "guerra" || despues === "alianza" ? 3 : 2, tribu: a.id, datos: { de: a.id, a: b.id, estado: despues } });
  }
}

function crearTareaEspecial(m: Mundo, t: Tribu, tipo: "incursion" | "comerciar", destino: { x: number; z: number }, datos: Record<string, unknown>): Tarea {
  const ta: Tarea = { id: m.nuevoId("t"), tribu: t.id, trabajo: tipo === "incursion" ? "pelear" : "comerciar", tipo, objetivo: null, x: destino.x, z: destino.z, prioridad: 4, asignado: null, creada: m.tick, datos };
  m.tareas.set(ta.id, ta);
  return ta;
}

/** Diplomacia y guerra, una vez cada ~1/12 de día. */
function diplomacia(m: Mundo, t: Tribu): void {
  const car = caracter(m, t);
  const vivos = m.miembros(t.id);
  const fuerza = vivos.filter((c) => !m.esNino(c)).reduce((s, c) => s + (c.equipo.arma ? 1.5 : 1) * (c.vida / 100), 0);
  for (const o of m.tribus.values()) {
    if (o === t || o.extinta) continue;
    const d = dist(t.centro, o.centro);
    // Vecinos que compiten por los mismos recursos se miran mal; los líderes belicosos empeoran todo.
    let delta = (d < 70 ? -1.8 : d < 110 ? -0.8 : 0) - car.belicosa * 2.2 + car.comerciante * 0.5 + m.azar.rango(-2, 1.5);
    // La distancia en el tiempo cura heridas (lentamente).
    if ((t.relaciones[o.id] ?? 0) < -30) delta += 0.5;
    cambiarRelacion(m, t, o, delta);
    const rel = t.relaciones[o.id] ?? 0;
    const dias = m.ticksDia;
    // Guerra: incursión si somos fuertes y hace rato que no.
    if (estado(rel) === "guerra" && m.tick - t.ultimaIncursion > dias * 0.6 && fuerza >= 2) {
      const fuerzaOtra = m.miembros(o.id).filter((c) => !m.esNino(c)).reduce((s, c) => s + (c.equipo.arma ? 1.5 : 1) * (c.vida / 100), 0);
      if (fuerza >= fuerzaOtra * 0.7 || car.belicosa > 0.8) {
        t.ultimaIncursion = m.tick;
        const n = Math.min(12, Math.max(2, Math.floor(vivos.length / 3)));
        const destino = m.almacenDe(o);
        const ejercito = m.nuevoId("x");
        for (let i = 0; i < n; i++) crearTareaEspecial(m, t, "incursion", destino, { tribu: o.id, ejercito, puesto: i, desdeX: t.centro.x, desdeZ: t.centro.z });
        m.emitir("incursion", n >= 6 ? `${t.nombre} reúne un ejército de ${n} contra ${o.nombre}.` : `${t.nombre} prepara una incursión contra ${o.nombre}.`, { x: t.centro.x, z: t.centro.z, interes: 3, tribu: t.id, datos: { objetivo: o.id } });
      }
    }
    // Comercio con aliados o en paz si hay excedente.
    if ((estado(rel) === "alianza" || (estado(rel) === "paz" && car.comerciante > 0.4)) && m.tick - t.ultimaCaravana > dias * 0.8) {
      const sobra = Object.entries(t.almacen).filter(([, n]) => n > 30).sort((a, b) => b[1] - a[1])[0];
      if (sobra) {
        t.ultimaCaravana = m.tick;
        crearTareaEspecial(m, t, "comerciar", m.almacenDe(o), { tribu: o.id, objeto: sobra[0], cantidad: 15 });
      }
    }
  }
}

/** Sistema de tribus: líder, extinción, diplomacia. */
/** CONQUISTA: un pueblo en guerra que se queda casi sin adultos sanos y con guerreros enemigos en su plaza se somete.
 *  Su gente jura lealtad al vencedor y sus casas, campos y talleres pasan a ser parte del imperio. */
function conquista(m: Mundo, t: Tribu): boolean {
  const miembros = m.miembros(t.id);
  const sanos = miembros.filter((c) => !m.esNino(c) && !c.derribado && c.vida > 30);
  if (sanos.length > 2) return false;
  for (const o of m.tribus.values()) {
    if (o === t || o.extinta || estado(t.relaciones[o.id] ?? 0) !== "guerra") continue;
    const enLaPlaza = m.colonosCerca(t.centro.x, t.centro.z, 40).filter((c) => c.tribu === o.id && !c.derribado && dist(c, t.centro) < 40);
    if (enLaPlaza.length < Math.max(2, sanos.length + 1)) continue;
    for (const c of miembros) {
      c.tribu = o.id;
      recordar(m, c, "robado", -10, `${o.nombre} conquistó nuestro pueblo`, 4);
      c.memoria.cambiarRelacion(o.lider ?? "", -10);
    }
    for (const e of estructurasDe(m, t)) e.tribu = o.id;
    for (const ta of [...m.tareas.values()]) if (ta.tribu === t.id) m.tareas.delete(ta.id);
    t.extinta = true;
    o.stats.ciudades = (o.stats.ciudades ?? 1) + 1 + (t.stats.ciudades ?? 1) - 1;
    for (const otra of m.tribus.values()) if (otra !== o && !otra.extinta) cambiarRelacion(m, otra, o, -6);
    m.emitir("conquista", `¡${o.nombre} conquista ${t.nombre}! ${miembros.length} personas juran lealtad y sus tierras pasan al imperio.`, { x: t.centro.x, z: t.centro.z, interes: 3, tribu: o.id, datos: { vencido: t.id } });
    m.recalcularTrazado();
    return true;
  }
  return false;
}

export function sistemaTribus(m: Mundo, _dt: number): void {
  if (m.tick % (HZ * 20) !== 7) return;
  for (const t of m.tribus.values()) {
    if (t.extinta) continue;
    const miembros = m.miembros(t.id);
    if (!miembros.length) {
      t.extinta = true;
      m.emitir("extincion", `La tribu ${t.nombre} ha desaparecido.`, { x: t.centro.x, z: t.centro.z, interes: 3, tribu: t.id });
      for (const e of estructurasDe(m, t)) if (e.progreso < 1) m.estructuras.delete(e.id);
      continue;
    }
    if (!t.lider || !m.colonos.get(t.lider)?.vivo) elegirLider(m, t);
    actualizarRango(m, t);
    if (conquista(m, t)) continue;
    if (m.tick % Math.round(m.ticksDia / 12) < HZ * 20) diplomacia(m, t);
    // Cada ~medio día, puede haber un cisma en un pueblo grande.
    if (m.tick % Math.round(m.ticksDia / 2) < HZ * 20 && m.azar.prob(0.35)) cisma(m, t);
  }
}
