// La mente de cada colono: decide qué hacer (necesidades, peligro, crisis, tareas del tablero de su tribu) con la
// IA por utilidad de TxNucleo (`ia.elegirAccion`), y ejecuta la actividad elegida: caminar hasta el objetivo y
// hacer el trabajo en pasos (golpes de hacha, entregas, bocados…). Aquí también vive el combate.

import { ia } from "txnucleo";
import { recordar } from "./animo.ts";
import { ARMADURAS, ARMAS, ESPECIES, ESTRUCTURAS, NODOS, OBJETOS, RECETA_POR_ID, VIVIENDAS, YACIMIENTOS } from "./catalogo.ts";
import { aportar, bono as bonoMejora, contagiarIdea } from "./tecnologia.ts";
import { HABILIDAD_DE } from "./datos/esquema.ts";
import { capacidad, cargaTotal, daniar, destreza, ganarXp, gusto, stat, tiene, tieneRasgo, velocidad } from "./colonos.ts";
import { matarAnimal } from "./fauna.ts";
import { HUELLAS, HZ, dist, type Mundo } from "./mundo.ts";
import { valorComida } from "./planificador.ts";
import { aguaCerca, aguaMasCercana, caminable } from "./terreno.ts";
import { asientoLibre } from "./asientos.ts";
import { disparar } from "./fisica.ts";
import type { Actividad, Colono, Estructura, Tarea, Tribu } from "./tipos.ts";

type Destino = Actividad["destino"];

export function nueva(m: Mundo, tipo: string, destino: Destino, op: { tarea?: string; objetivo?: string; restante?: number; datos?: Record<string, unknown> } = {}): Actividad {
  return { tipo, tarea: op.tarea, objetivo: op.objetivo, destino, camino: [], restante: op.restante ?? 0, hechas: 0, recalculo: -999, inicio: m.tick, datos: op.datos ?? {} };
}

function soltarTarea(m: Mundo, c: Colono): void {
  const id = c.actividad?.tarea;
  if (id) {
    const t = m.tareas.get(id);
    if (t && t.asignado === c.id) t.asignado = null;
  }
}

function terminar(m: Mundo, c: Colono, completarTarea = false): void {
  const id = c.actividad?.tarea;
  if (id && completarTarea) m.tareas.delete(id);
  else soltarTarea(m, c);
  if (c.actividad?.tipo === "dormir") c.dormido = false;
  c.actividad = null;
  c.proximaDecision = m.tick + Math.round(HZ * 0.4);
}

export const objetivoPos = (m: Mundo, id: string | undefined): { x: number; z: number } | null => {
  if (!id) return null;
  const c = m.colonos.get(id);
  if (c) return c.vivo ? c : null;
  const b = m.animales.get(id);
  if (b) return { x: b.cuerpo.x, z: b.cuerpo.y };
  const n = m.nodos.get(id) ?? m.estructuras.get(id) ?? m.cuerpos.get(id);
  if (n) return n;
  const f = m.incendios.get(id);
  return f ?? null;
};

// ------------------------------------------------------------ amenazas

interface Amenaza { id: string; x: number; z: number; tipo: "animal" | "enemigo"; }

export function enGuerra(m: Mundo, a: string, b: string): boolean {
  if (a === b) return false;
  return (m.tribus.get(a)?.relaciones[b] ?? 0) <= -60;
}

function amenazaCerca(m: Mundo, c: Colono, radio = 12): Amenaza | null {
  let mejor: Amenaza | null = null, md = radio;
  for (const b of m.animalesCerca(c.x, c.z, radio)) {
    const esp = ESPECIES.get(b.especie)!;
    if (esp.conducta === "presa") continue;
    const d = Math.hypot(b.cuerpo.x - c.x, b.cuerpo.y - c.z);
    const peligroso = b.objetivo === c.id || (esp.conducta === "depredador" && d < 6 && b.estado === "cazar");
    if (peligroso && d < md) { md = d; mejor = { id: b.id, x: b.cuerpo.x, z: b.cuerpo.y, tipo: "animal" }; }
  }
  for (const o of m.colonosCerca(c.x, c.z, radio)) {
    if (!o.vivo || o.derribado || o.tribu === c.tribu || !enGuerra(m, c.tribu, o.tribu)) continue;
    const d = dist(o, c);
    if (d < md) { md = d; mejor = { id: o.id, x: o.x, z: o.z, tipo: "enemigo" }; }
  }
  return mejor;
}

/** Enemigos dentro del territorio de una tribu (para defenderlo). */
function intrusos(m: Mundo, t: Tribu): Amenaza[] {
  const r: Amenaza[] = [];
  for (const o of m.colonos.values()) {
    if (o.vivo && !o.derribado && o.tribu !== t.id && enGuerra(m, t.id, o.tribu) && dist(o, t.centro) < 26) r.push({ id: o.id, x: o.x, z: o.z, tipo: "enemigo" });
  }
  for (const b of m.animales.values()) {
    if ((b.especie === "lobo" || b.especie === "oso") && b.estado === "cazar" && Math.hypot(b.cuerpo.x - t.centro.x, b.cuerpo.y - t.centro.z) < 20) r.push({ id: b.id, x: b.cuerpo.x, z: b.cuerpo.y, tipo: "animal" });
  }
  return r;
}

function valiente(c: Colono): boolean {
  if (tiene(c, "pacifista") || tiene(c, "cobarde")) return false;
  return tiene(c, "temerario") || tiene(c, "sanguinario") || tiene(c, "protector") || c.personalidad.valiente > 0.1 || !!c.equipo.arma;
}

// ------------------------------------------------------------ decidir

interface Opcion extends ia.AccionUtil<null> { crear: () => Actividad | null; }

function opcion(nombre: string, peso: number, crear: () => Actividad | null): Opcion {
  return { nombre, peso, consideraciones: [], crear };
}

/** Fogata propia más cercana, encendida o no (para avivarla). */
function fogataPropia(m: Mundo, c: Colono): Estructura | null {
  let mejor: Estructura | null = null, md = 70;
  for (const e of m.estructuras.values()) {
    if (e.tipo !== "fogata" || e.tribu !== c.tribu || e.progreso < 1) continue;
    const d = dist(e, c);
    if (d < md) { md = d; mejor = e; }
  }
  return mejor;
}

/** Casa propia más cercana donde guarecerse (aunque no tenga cama libre). */
function refugioPropio(m: Mundo, c: Colono): Estructura | null {
  let mejor: Estructura | null = null, md = 80;
  for (const e of m.estructuras.values()) {
    if (e.tribu !== c.tribu || e.progreso < 1 || !ESTRUCTURAS.get(e.tipo)?.aislamiento) continue;
    const d = dist(e, c);
    if (d < md) { md = d; mejor = e; }
  }
  return mejor;
}

const temporadaFria = (m: Mundo): boolean => m.estacion === "otoño" || m.estacion === "invierno";

function fuegoTribu(m: Mundo, c: Colono): { x: number; z: number; id: string } | null {
  let mejor: { x: number; z: number; id: string } | null = null, md = Infinity;
  for (const e of m.estructuras.values()) {
    if (!ESTRUCTURAS.get(e.tipo)?.fuego || e.progreso < 1 || e.combustible <= 0) continue;
    const d = dist(e, c) + (e.tribu === c.tribu ? 0 : 40);
    if (d < md) { md = d; mejor = e; }
  }
  return md < 70 ? mejor : null;
}

/** Elige la próxima actividad del colono. */
export function decidir(m: Mundo, c: Colono): Actividad | null {
  const t = m.tribus.get(c.tribu);
  const n = (id: string): number => c.necesidades.valor(id);
  const ops: Opcion[] = [];
  const nino = m.esNino(c);
  const amenaza = amenazaCerca(m, c);
  if (amenaza) {
    if (!nino && valiente(c) && c.vida > 35) ops.push(opcion("pelear", 6 * (1 + c.personalidad.valiente * 0.5), () => nueva(m, "pelear", { x: amenaza.x, z: amenaza.z, alcance: alcance(c) }, { objetivo: amenaza.id })));
    else ops.push(opcion("huir", 7, () => huida(m, c, amenaza)));
  }
  if (t && !nino && !amenaza && valiente(c)) {
    const intr = intrusos(m, t);
    if (intr.length) {
      const o = intr.sort((a, b) => dist(a, c) - dist(b, c))[0];
      ops.push(opcion("defender", 4.5 * Math.max(0.2, gusto(c, "pelear")), () => nueva(m, "pelear", { x: o.x, z: o.z, alcance: alcance(c) }, { objetivo: o.id })));
    }
  }
  if (!nino && !c.crisis) {
    const caido = caidoCerca(m, c);
    if (caido) ops.push(opcion("rescatar", 6.5 * (1 + c.personalidad.empatico * 0.3), () => nueva(m, "curar", { x: caido.x, z: caido.z, alcance: 1.4 }, { objetivo: caido.id, restante: 3 })));
  }
  if (n("sed") < 60) ops.push(opcion("beber", 4.5 * (1 - n("sed") / 100) ** 1.5 + (n("sed") < 35 ? 6 : 0) + (n("sed") < 15 ? 20 : 0), () => beber(m, c)));
  if (n("hambre") < 55) ops.push(opcion("comer", 4 * (1 - n("hambre") / 100) ** 1.5 + (n("hambre") < 30 ? 6 : 0) + (n("hambre") < 12 ? 20 : 0), () => comer(m, c)));
  const noct = tiene(c, "noctambulo");
  const deNoche = m.esNoche || m.ciclo.fase.nombre === "atardecer";
  const horaDormir = noct ? !deNoche : deNoche;
  if (n("energia") < 25 || (horaDormir && n("energia") < 75)) ops.push(opcion("dormir", n("energia") < 25 ? 4 : 2.6, () => dormir(m, c)));
  {
    const fog = fogataPropia(m, c);
    const tAv = m.tribus.get(c.tribu);
    const umbral = temporadaFria(m) || m.esNoche ? 900 : 300;
    if (fog && tAv && (tAv.almacen.madera ?? 0) >= 3 && fog.combustible < umbral && !m.esNino(c)) {
      const ocupado = [...m.colonos.values()].some((o) => o.vivo && o.id !== c.id && o.actividad?.tipo === "avivar" && o.actividad.objetivo === fog.id);
      if (!ocupado) {
        const urgencia = (fog.combustible <= 0 ? 4 : 1.5) + (c.temperatura < 36 ? 6 : 0) + (temporadaFria(m) ? 2 : 0);
        ops.push(opcion("avivar", urgencia, () => nueva(m, "avivar", { x: fog.x, z: fog.z, alcance: 2 }, { objetivo: fog.id, restante: 1.5 })));
      }
    }
  }
  if (c.temperatura < 36) ops.push(opcion("calentarse", 3.5 + (c.temperatura < 35 ? 8 : 0), () => calentarse(m, c)));
  if (n("ocio") < 35) ops.push(opcion("ocio", 1.5 * (1 - n("ocio") / 100), () => ocio(m, c)));
  if (n("social") < 35 && !tiene(c, "ermitano")) ops.push(opcion("charlar", 1.3 * (1 - n("social") / 100) * (1 + c.personalidad.sociable * 0.4), () => charlar(m, c)));
  // Trabajo del tablero.
  if (t && !nino && !c.crisis) {
    const mejor = mejorTarea(m, c, t);
    if (mejor) ops.push(opcion(`tarea:${mejor.tarea.id}`, mejor.puntaje, () => tomarTarea(m, c, mejor.tarea)));
  }
  // Conductas espontáneas de los rasgos.
  if (t && !nino && tiene(c, "piromano") && m.azar.prob(0.004)) ops.push(opcion("prender", 2, () => nueva(m, "prender", { ...m.lugarLibre({ cerca: t.centro, radio: 25 }), alcance: 1 }, { restante: 3 })));
  if (!nino && tiene(c, "cleptomano") && m.azar.prob(0.01)) {
    const otra = [...m.tribus.values()].find((x) => x.id !== c.tribu && !x.extinta && dist(m.almacenDe(x), c) < 60);
    if (otra) ops.push(opcion("hurtar", 2.2, () => nueva(m, "incursion", { ...m.almacenDe(otra), alcance: 2 }, { datos: { tribu: otra.id, sigilo: true } })));
  }
  if (tiene(c, "nomada") && m.azar.prob(0.05)) ops.push(opcion("explorar", 0.9, () => nueva(m, "ir", { ...m.lugarLibre({ cerca: t?.centro ?? c, radio: 40 }), alcance: 1 }, { datos: { motivo: "explorar" } })));
  if (nino) ops.push(opcion("jugar", 0.8, () => nueva(m, "jugar", { ...m.lugarLibre({ cerca: t?.centro ?? c, radio: 8 }), alcance: 1 }, { restante: 6 })));
  ops.push(opcion("pasear", 0.18, () => (t && dist(c, t.centro) > 14 ? nueva(m, "ir", { ...m.lugarLibre({ cerca: t.centro, radio: 8 }), alcance: 1.5 }) : ocio(m, c))));
  const elegida = ia.elegirAccion(ops, null, { azar: m.azar, top: 2 });
  return elegida ? (elegida.accion as Opcion).crear() : null;
}

/** Compañero de tribu malherido en el suelo que nadie está atendiendo. */
function caidoCerca(m: Mundo, c: Colono): Colono | null {
  let mejor: Colono | null = null, md = 70;
  for (const o of m.colonos.values()) {
    if (!o.vivo || !o.derribado || o.tribu !== c.tribu || o.id === c.id) continue;
    const d = dist(o, c);
    if (d >= md) continue;
    let atendido = false;
    for (const x of m.colonos.values()) if (x.vivo && x.id !== c.id && x.actividad?.tipo === "curar" && x.actividad.objetivo === o.id) { atendido = true; break; }
    if (!atendido) { md = d; mejor = o; }
  }
  return mejor;
}

/** Alarma: cuando atacan a un colono, los compañeros armados o valientes cercanos acuden. */
export function alarma(m: Mundo, victima: Colono, atacante: string): void {
  if (m.tick - (victima.stats.ultimaAlarma ?? -1e9) < HZ * 3) return;
  victima.stats.ultimaAlarma = m.tick;
  const pos = objetivoPos(m, atacante);
  if (!pos) return;
  let acuden = 0;
  for (const o of m.colonos.values()) {
    if (!o.vivo || o.derribado || o.crisis || o.id === victima.id || o.tribu !== victima.tribu || m.esNino(o)) continue;
    if (dist(o, victima) > (o.dormido ? 8 : 26)) continue;
    if (!valiente(o) || o.vida < 40 || o.actividad?.tipo === "pelear") continue;
    soltarTarea(m, o);
    if (o.dormido) o.dormido = false;
    o.actividad = nueva(m, "pelear", { x: pos.x, z: pos.z, alcance: alcance(o) }, { objetivo: atacante });
    if (++acuden >= 4) break;
  }
  if (acuden > 0) m.emitir("alarma", `${victima.nombre} pide ayuda: ${acuden} acuden a defenderlo.`, { x: victima.x, z: victima.z, actores: [victima.id], interes: 1, tribu: victima.tribu });
}

function alcance(c: Colono): number {
  return c.equipo.arma ? OBJETOS.get(c.equipo.arma)!.arma!.alcance : 1.3;
}

function mejorTarea(m: Mundo, c: Colono, t: Tribu): { tarea: Tarea; puntaje: number } | null {
  let mejor: { tarea: Tarea; puntaje: number } | null = null;
  const deNoche = m.esNoche && !tiene(c, "noctambulo");
  for (const ta of m.tareas.values()) {
    if (ta.tribu !== t.id || (ta.asignado && ta.asignado !== c.id)) continue;
    if (ta.tipo === "curar" && ta.objetivo === c.id) continue;
    if (ta.tipo === "cazar" && tiene(c, "vegetariano")) continue;
    if ((ta.tipo === "incursion" || ta.tipo === "cazar") && !c.equipo.arma && ta.tipo === "incursion") continue;
    const g = gusto(c, ta.trabajo);
    if (g <= 0) continue;
    const d = Math.hypot(ta.x - c.x, ta.z - c.z);
    let p = (ta.prioridad / 2) * g * destreza(c, HABILIDAD_DE[ta.trabajo]) * (1 + 0.25 * c.personalidad.trabajador) * (1 / (1 + d / 45));
    if (tiene(c, "perezoso")) p *= 0.6;
    if (tiene(c, "rebelde")) p *= m.azar.rango(0.3, 1.4);
    if (c.animo < 30) p *= 0.7;
    if (deNoche && !["vigilar", "apagar", "avivar", "curar"].includes(ta.tipo)) p *= 0.35;
    if (!mejor || p > mejor.puntaje) mejor = { tarea: ta, puntaje: p };
  }
  return mejor;
}

function tomarTarea(m: Mundo, c: Colono, ta: Tarea): Actividad | null {
  ta.asignado = c.id;
  const base = { tarea: ta.id, objetivo: ta.objetivo ?? undefined };
  switch (ta.tipo) {
    case "talar": case "minar": case "recolectar": {
      const nodo = m.nodos.get(ta.objetivo!);
      if (!nodo) return null;
      const req = NODOS.get(nodo.tipo)!.def.herramienta;
      if (req > gradoDe(c, NODOS.get(nodo.tipo)!.trabajo)) {
        const t = m.tribus.get(c.tribu);
        const pico = t ? Object.keys(t.almacen).find((o) => { const h = OBJETOS.get(o)?.herramienta; return !!h && h.para === NODOS.get(nodo.tipo)!.trabajo && h.grado >= req; }) : undefined;
        if (!t || !pico) { ta.asignado = null; return null; }
        m.sacar(t, pico, 1);
        if (c.equipo.herramienta) m.meter(t, c.equipo.herramienta, 1);
        c.equipo.herramienta = pico;
      }
      // Toma la herramienta del almacén si le sirve.
      const yac = YACIMIENTOS[nodo.tipo];
      if (yac) {
        // Cada minero en su lado de la boca de la mina (según su id), mirando al centro.
        let h = 0;
        for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const ang = ((h % 360) * Math.PI) / 180;
        const x = nodo.x + Math.cos(ang) * (yac.radio + 0.7), z = nodo.z + Math.sin(ang) * (yac.radio + 0.7);
        return nueva(m, ta.tipo, { x, z, alcance: 1.2 }, { ...base, restante: NODOS.get(nodo.tipo)!.segundosPorGolpe, datos: { mira: Math.atan2(nodo.x - x, nodo.z - z) } });
      }
      return nueva(m, ta.tipo, { x: nodo.x, z: nodo.z, alcance: 1.3 }, { ...base, restante: NODOS.get(nodo.tipo)!.segundosPorGolpe });
    }
    case "cazar": {
      const b = m.animales.get(ta.objetivo!);
      if (!b) return null;
      return nueva(m, "cazar", { x: b.cuerpo.x, z: b.cuerpo.y, alcance: alcance(c) }, base);
    }
    case "construir": {
      const e = m.estructuras.get(ta.objetivo!);
      if (!e) return null;
      return nueva(m, "construir", { x: e.x, z: e.z, alcance: ESTRUCTURAS.get(e.tipo)!.radio + 0.8 }, { ...base, restante: 1 });
    }
    case "sembrar": case "cosechar": {
      const e = m.estructuras.get(ta.objetivo!)!;
      return nueva(m, ta.tipo, { x: e.x, z: e.z, alcance: 2.2 }, { ...base, restante: 4 });
    }
    case "cocinar": case "fabricar": {
      const e = m.estructuras.get(ta.objetivo!);
      if (!e) return null;
      return nueva(m, ta.tipo, { x: e.x, z: e.z, alcance: 2.2 }, { ...base, restante: RECETA_POR_ID.get(String(ta.datos.receta))?.segundos ?? 6, datos: { receta: ta.datos.receta } });
    }
    case "avivar": {
      const e = m.estructuras.get(ta.objetivo!);
      if (!e) return null;
      return nueva(m, "avivar", { x: e.x, z: e.z, alcance: 2 }, { ...base, restante: 1.5 });
    }
    case "curar": {
      const p = m.colonos.get(ta.objetivo!);
      if (!p) return null;
      return nueva(m, "curar", { x: p.x, z: p.z, alcance: 1.4 }, { ...base, restante: 4 });
    }
    case "vigilar":
      return nueva(m, "vigilar", { x: ta.x, z: ta.z, alcance: 2 }, { ...base, restante: 5 });
    case "investigar": {
      const banco = asientoLibre(m, c, 60, ["circulo", "biblioteca"]);
      if (banco && Math.hypot(banco.x - ta.x, banco.z - ta.z) < 8) return nueva(m, "investigar", { x: banco.x, z: banco.z, alcance: 0.12 }, { ...base, restante: 6, datos: { asiento: banco.clave, mira: banco.mira } });
    }
      return nueva(m, "investigar", { x: ta.x, z: ta.z, alcance: 2.6 }, { ...base, restante: 6 });
    case "apagar":
      return nueva(m, "apagar", { x: ta.x, z: ta.z, alcance: 1.5 }, { ...base, restante: 1.5 });
    case "incursion": {
      const puesto = Number(ta.datos.puesto ?? 0);
      const dx = ta.x - Number(ta.datos.desdeX ?? c.x), dz = ta.z - Number(ta.datos.desdeZ ?? c.z);
      const l = Math.hypot(dx, dz) || 1;
      const ux = dx / l, uz = dz / l;
      const col = (puesto % 4) - 1.5, fila = Math.floor(puesto / 4);
      // Se forman a 8 m del objetivo: columnas de lado a lado y filas hacia atrás.
      const x = ta.x - ux * (8 + fila * 1.8) - uz * col * 1.8, z = ta.z - uz * (8 + fila * 1.8) + ux * col * 1.8;
      return nueva(m, "incursion", { x, z, alcance: 2.0 }, { ...base, datos: { ...ta.datos, x: ta.x, z: ta.z } });
    }
    case "comerciar":
      return nueva(m, "comerciar", { x: ta.x, z: ta.z, alcance: 2.5 }, { ...base, datos: { ...ta.datos } });
  }
  return null;
}

// ------------------------------------------------------------ necesidades

const PREFERENCIA = ["guiso", "carne_asada", "pan_raices", "verdura", "bayas", "carne_cruda"];

function comer(m: Mundo, c: Colono): Actividad | null {
  // ¿Lleva comida encima?
  for (const o of PREFERENCIA) if ((c.carga[o] ?? 0) > 0 && !(tiene(c, "vegetariano") && OBJETOS.get(o)!.comida!.carne)) return nueva(m, "comer", null, { restante: 2, datos: { de: "carga" } });
  const t = m.tribus.get(c.tribu);
  const lejos = t ? dist(m.almacenDe(t), c) > 50 && c.necesidades.valor("hambre") < 20 : true;
  if (t && !lejos && PREFERENCIA.some((o) => (t.almacen[o] ?? 0) > 0 && !(tiene(c, "vegetariano") && OBJETOS.get(o)!.comida!.carne))) {
    const a = m.almacenDe(t);
    return nueva(m, "comer", { x: a.x, z: a.z, alcance: 2.5 }, { restante: 2, datos: { de: "almacen" } });
  }
  // Sin comida en el almacén: forrajear bayas.
  let mejor: { x: number; z: number; id: string } | null = null, md = 60;
  for (const nd of m.nodosCerca(c.x, c.z, 60)) {
    if (nd.tipo !== "arbusto" || !nd.nodo.disponible || nd.quemado) continue;
    const d = dist(nd, c);
    if (d < md) { md = d; mejor = nd; }
  }
  if (mejor) return nueva(m, "forrajear", { x: mejor.x, z: mejor.z, alcance: 1.3 }, { objetivo: mejor.id, restante: 2 });
  // Ni almacén ni bayas: cazar lo que haya o comer de un cadáver.
  const cadaver = [...m.cuerpos.values()].filter((k) => k.tipo === "animal" && (k.contenido.carne_cruda ?? 0) > 0 && dist(k, c) < 50).sort((p, q) => dist(p, c) - dist(q, c))[0];
  if (cadaver) {
    c.carga.carne_cruda = (c.carga.carne_cruda ?? 0) + 1;
    cadaver.contenido.carne_cruda--;
    return nueva(m, "comer", null, { restante: 2, datos: { de: "carga" } });
  }
  if (!tiene(c, "vegetariano")) {
    const presa = [...m.animales.values()].filter((b) => ESPECIES.get(b.especie)!.conducta === "presa" && Math.hypot(b.cuerpo.x - c.x, b.cuerpo.y - c.z) < 60)
      .sort((p, q) => Math.hypot(p.cuerpo.x - c.x, p.cuerpo.y - c.z) - Math.hypot(q.cuerpo.x - c.x, q.cuerpo.y - c.z))[0];
    if (presa) return nueva(m, "cazar", { x: presa.cuerpo.x, z: presa.cuerpo.y, alcance: alcance(c) }, { objetivo: presa.id });
  }
  return null;
}

/** Pozo terminado más cercano (de cualquier tribu en paz) a menos de `r`. */
export function pozoCerca(m: Mundo, x: number, z: number, r: number, tribu?: string): { x: number; z: number; d: number } | null {
  let mejor: { x: number; z: number; d: number } | null = null;
  for (const e of m.estructuras.values()) {
    if (e.tipo !== "pozo" || e.progreso < 1) continue;
    if (tribu && e.tribu && e.tribu !== tribu && enGuerra(m, tribu, e.tribu)) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d <= r && (!mejor || d < mejor.d)) mejor = { x: e.x, z: e.z, d };
  }
  return mejor;
}

export function hayAgua(m: Mundo, x: number, z: number, radio = 2.4): boolean {
  return aguaCerca(m.terreno, x, z, radio) || !!pozoCerca(m, x, z, radio + 0.6);
}

function beber(m: Mundo, c: Colono): Actividad | null {
  if (hayAgua(m, c.x, c.z, 1.8)) return nueva(m, "beber", null, { restante: 2.5 });
  const a = aguaMasCercana(m.terreno, c.x, c.z, 120);
  const p = pozoCerca(m, c.x, c.z, 120, c.tribu);
  const destino = p && (!a || p.d < a.distancia + 4) ? { x: p.x, z: p.z, alcance: 1.8 } : a ? { x: a.x, z: a.z, alcance: 1.6 } : null;
  return destino ? nueva(m, "beber", destino, { restante: 2.5 }) : null;
}

function dormir(m: Mundo, c: Colono): Actividad {
  const cama = c.cama ? m.estructuras.get(c.cama) : undefined;
  if (cama && cama.progreso >= 1) return nueva(m, "dormir", { x: cama.x, z: cama.z, alcance: 1.2 }, { restante: 1 });
  const techo = refugioPropio(m, c);
  if (techo && (temporadaFria(m) || m.temperaturaEn(c.x, c.z) < 12)) return nueva(m, "dormir", { x: techo.x, z: techo.z, alcance: 1.2 }, { restante: 1 });
  const f = fuegoTribu(m, c);
  if (f && dist(f, c) < 50) return nueva(m, "dormir", { x: f.x + m.azar.rango(-2.5, 2.5), z: f.z + m.azar.rango(-2.5, 2.5), alcance: 0.8 }, { restante: 1 });
  return nueva(m, "dormir", null, { restante: 1 });
}

function calentarse(m: Mundo, c: Colono): Actividad | null {
  const f = fuegoTribu(m, c);
  const banco = f ? asientoLibre(m, c, 35, ["fogata"]) : null;
  if (banco) return nueva(m, "calentarse", { x: banco.x, z: banco.z, alcance: 0.12 }, { restante: 4, datos: { asiento: banco.clave, mira: banco.mira } });
  if (f) return nueva(m, "calentarse", { x: f.x + m.azar.rango(-1.8, 1.8), z: f.z + m.azar.rango(-1.8, 1.8), alcance: 0.8 }, { restante: 4 });
  const cama = c.cama ? m.estructuras.get(c.cama) : undefined;
  if (cama && cama.progreso >= 1) return nueva(m, "calentarse", { x: cama.x, z: cama.z, alcance: 1.2 }, { restante: 4 });
  const techo = refugioPropio(m, c);
  if (techo) return nueva(m, "calentarse", { x: techo.x, z: techo.z, alcance: 1.2 }, { restante: 4 });
  return null;
}

function ocio(m: Mundo, c: Colono): Actividad {
  const f = fuegoTribu(m, c);
  const r = m.azar.siguiente();
  const templo = [...m.estructuras.values()].find((e) => e.tribu === c.tribu && e.tipo === "templo" && e.progreso >= 1 && dist(e, c) < 80);
  if (templo && r < 0.3) return nueva(m, "ocio", { x: templo.x, z: templo.z + 4, alcance: 2.5 }, { restante: 18, datos: { modo: "templo" } });
  const banco = f && (r < 0.5 || m.esNoche) ? asientoLibre(m, c, 40, ["fogata", "circulo"]) : null;
  if (banco) return nueva(m, "ocio", { x: banco.x, z: banco.z, alcance: 0.12 }, { restante: 25, datos: { modo: "fuego", asiento: banco.clave, mira: banco.mira } });
  if (f && (r < 0.5 || m.esNoche)) return nueva(m, "ocio", { x: f.x + m.azar.rango(-2.5, 2.5), z: f.z + m.azar.rango(-2.5, 2.5), alcance: 0.8 }, { restante: 25, datos: { modo: "fuego" } });
  if (m.esNoche && m.clima.tipo === "despejado") return nueva(m, "ocio", null, { restante: 20, datos: { modo: "estrellas" } });
  return nueva(m, "ocio", { ...m.lugarLibre({ cerca: c, radio: 12 }), alcance: 1 }, { restante: 15, datos: { modo: "pasear" } });
}

function charlar(m: Mundo, c: Colono): Actividad | null {
  let mejor: Colono | null = null, mp = -Infinity;
  for (const o of m.colonos.values()) {
    if (!o.vivo || o.id === c.id || o.dormido || o.derribado || o.tribu !== c.tribu) continue;
    const d = dist(o, c);
    if (d > 40) continue;
    const p = c.memoria.relacion(o.id) - d;
    if (p > mp) { mp = p; mejor = o; }
  }
  if (!mejor) return null;
  return nueva(m, "charlar", { x: mejor.x, z: mejor.z, alcance: 2 }, { objetivo: mejor.id, restante: 10 });
}

function huida(m: Mundo, c: Colono, a: Amenaza): Actividad {
  const t = m.tribus.get(c.tribu);
  const refugio = t ? [...m.estructuras.values()].find((e) => e.tribu === t.id && e.tipo === "casa" && e.progreso >= 1) : undefined;
  if (refugio && dist(refugio, a) > dist(refugio, c)) return nueva(m, "huir", { x: refugio.x, z: refugio.z, alcance: 1 }, { datos: { de: a.id } });
  const dx = c.x - a.x, dz = c.z - a.z, l = Math.hypot(dx, dz) || 1;
  let x = c.x + (dx / l) * 18, z = c.z + (dz / l) * 18;
  if (!caminable(m.terreno, Math.floor(x), Math.floor(z))) ({ x, z } = m.lugarLibre({ cerca: c, radio: 15 }));
  return nueva(m, "huir", { x, z, alcance: 1 }, { datos: { de: a.id } });
}

// ------------------------------------------------------------ ejecutar (cada tick)

export function sistemaActividades(m: Mundo, dt: number): void {
  for (const c of m.colonos.values()) {
    if (!c.vivo || c.derribado) continue;
    if (c.crisis) {
      crisis(m, c, dt);
      continue;
    }
    // Revisión de peligro cada segundo (interrumpe lo que no sea pelear o huir).
    if ((m.tick + c.nacio) % HZ === 0 && c.actividad && !["pelear", "huir", "incursion", "comer", "beber", "forrajear"].includes(c.actividad.tipo)) {
      const a = amenazaCerca(m, c, c.dormido ? 4 : 10);
      if (a || c.necesidades.valor("hambre") < 20 || c.necesidades.valor("sed") < 22) {
        if (c.dormido) { c.dormido = false; recordar(m, c, "durmio_mal", -4, "Me despertaron de golpe", 0.5); }
        terminar(m, c);
      }
    }
    if (!c.actividad) {
      if (m.tick < c.proximaDecision) continue;
      c.actividad = decidir(m, c);
      c.proximaDecision = m.tick + Math.round(HZ * (c.actividad ? 0.5 : 2));
      if (!c.actividad) continue;
    }
    ejecutar(m, c, dt);
  }
}

function ejecutar(m: Mundo, c: Colono, dt: number): void {
  const a = c.actividad!;
  // Objetivos que se mueven.
  if (["cazar", "pelear", "curar", "charlar"].includes(a.tipo)) {
    const p = objetivoPos(m, a.objetivo);
    if (!p) return terminar(m, c, a.tipo === "cazar");
    if (a.destino && dist(a.destino, p) > 1) {
      a.destino = { ...p, alcance: a.destino.alcance };
      if (m.tick - a.recalculo > HZ) a.camino = [];
    }
    if ((a.tipo === "pelear" || a.tipo === "cazar") && dist(c, p) > 45) return terminar(m, c);
  }
  if (a.destino && dist(c, a.destino) > a.destino.alcance) {
    if (a.camino.length === 0) {
      if (a.recalculo >= 0 && m.tick - a.recalculo < 2) return terminar(m, c);
      const ruta = m.camino(c.x, c.z, a.destino.x, a.destino.z);
      a.recalculo = m.tick;
      if (!ruta) {
        if (a.tipo === "incursion" && asediar(m, c, a)) return;
        return terminar(m, c);
      }
      a.camino = ruta.length ? ruta : [[a.destino.x, a.destino.z]];
    }
    const v = velocidad(c) * (a.tipo === "huir" || a.tipo === "pelear" ? 1.35 : 1);
    c.atascado = false;
    m.avanzarCamino(c, a.camino, v, dt);
    if (c.atascado) {
      c.atascado = false;
      if (dist(c, a.destino) <= a.destino.alcance + 3) a.destino = { ...a.destino, alcance: dist(c, a.destino) + 0.05 };
      else return terminar(m, c);
      return;
    }
    if (a.camino.length === 0 && dist(c, a.destino) > a.destino.alcance) {
      // Último tramo hasta el destino solo si se puede pisar; si no, ya está lo más cerca posible.
      if (m.pisable(a.destino.x, a.destino.z)) a.camino = [[a.destino.x, a.destino.z]];
      else a.destino = { ...a.destino, alcance: dist(c, a.destino) + 0.05 };
    }
    return;
  }
  if (a.destino) {
    const p = objetivoPos(m, a.objetivo) ?? a.destino;
    if (typeof a.datos.mira === "number") c.rumbo = a.datos.mira;
    else if (dist(p, c) > 0.2) c.rumbo = Math.atan2(p.x - c.x, p.z - c.z);
  }
  if (a.tipo === "ir" || a.tipo === "huir") return terminar(m, c);
  a.restante -= dt * (["talar", "minar", "recolectar", "construir", "cocinar", "fabricar", "sembrar", "cosechar", "curar"].includes(a.tipo) ? stat(c, "trabajo") : 1);
  if (a.restante > 0) return;
  efecto(m, c, a);
}

const TRABAJO_CHARLA: Record<string, number> = { talar: 0, minar: 1, construir: 2, cazar: 3, cocinar: 4, fabricar: 5 };

function efecto(m: Mundo, c: Colono, a: Actividad): void {
  const t = m.tribus.get(c.tribu);
  if (TRABAJO_CHARLA[a.tipo] !== undefined) c.stats.ultimoTrabajo = TRABAJO_CHARLA[a.tipo];
  switch (a.tipo) {
    case "talar": case "minar": case "recolectar": case "forrajear": {
      const n = m.nodos.get(a.objetivo ?? "");
      if (!n || !n.nodo.disponible || n.quemado) {
        if (a.tipo !== "forrajear" && cargaTotal(c) > 0) return irADepositar(m, c, true);
        return terminar(m, c, true);
      }
      const def = NODOS.get(n.tipo)!;
      const herr = c.equipo.herramienta ? OBJETOS.get(c.equipo.herramienta)!.herramienta : undefined;
      const bono = (herr && herr.para === def.trabajo ? herr.bono : 1) * (0.7 + 0.3 * stat(c, "fuerza")) * bonoMejora(t, def.trabajo);
      const r = n.nodo.golpear(herr && herr.para === def.trabajo ? herr.grado : 0, m.azar.siguiente(), bono);
      if (typeof r === "string") return terminar(m, c, true);
      ganarXp(m, c, HABILIDAD_DE[def.trabajo as keyof typeof HABILIDAD_DE] ?? "recoleccion", 6);
      if (a.tipo === "forrajear") {
        c.necesidades.reponer("hambre", valorComida(r.recurso) * r.cantidad);
      } else {
        c.carga[r.recurso] = (c.carga[r.recurso] ?? 0) + r.cantidad;
        for (const [o, prob] of def.extra ?? []) if (m.azar.prob(prob)) c.carga[o] = (c.carga[o] ?? 0) + 1;
      }
      a.hechas++;
      if (!n.nodo.disponible) {
        n.espera = n.nodo.def.reaparicion;
        m.nodosCambiados.add(n.id);
        if (n.tipo === "arbol") m.emitir("tala", `${c.nombre} derriba un ${n.variante}.`, { x: n.x, z: n.z, actores: [c.id], interes: 0, tribu: c.tribu });
      }
      if (a.tipo === "forrajear") {
        if (c.necesidades.valor("hambre") > 85 || !n.nodo.disponible) return terminar(m, c);
        a.restante = def.segundosPorGolpe;
        return;
      }
      if (cargaTotal(c) >= capacidad(c) || !n.nodo.disponible) {
        recordar(m, c, "trabajo_hecho", 1, "Hice un buen trabajo", 0.3);
        return irADepositar(m, c, !n.nodo.disponible);
      }
      a.restante = def.segundosPorGolpe / destreza(c, HABILIDAD_DE[def.trabajo as keyof typeof HABILIDAD_DE] ?? "recoleccion");
      return;
    }
    case "depositar": {
      if (t) {
        for (const [o, n] of Object.entries(c.carga)) m.meter(t, o, n);
        // Solo en el almacén o el centro urbano hay equipo para cambiarse.
        if (a.datos.donde === "almacen" || a.datos.donde === "centro") equiparse(m, c, t);
      }
      c.carga = {};
      return terminar(m, c, false);
    }
    case "comer": {
      let comido = false;
      const veg = tiene(c, "vegetariano");
      const raciones = tiene(c, "gloton") ? 2 : 1;
      for (let k = 0; k < raciones; k++) {
        for (const o of PREFERENCIA) {
          if (veg && OBJETOS.get(o)!.comida!.carne) continue;
          let ok = false;
          if ((c.carga[o] ?? 0) > 0) { c.carga[o]--; if (!c.carga[o]) delete c.carga[o]; ok = true; }
          else if (t && a.datos.de === "almacen" && m.sacar(t, o, 1) > 0) ok = true;
          if (!ok) continue;
          const def = OBJETOS.get(o)!.comida!;
          c.necesidades.reponer("hambre", def.hambre);
          if (def.cruda) recordar(m, c, "comio_crudo", -4, "Comí carne cruda", 0.5);
          else if (def.hambre >= 30) recordar(m, c, "comio_bien", 4, `Comí ${OBJETOS.get(o)!.nombre}`, 0.5);
          comido = true;
          break;
        }
      }
      if (comido && c.necesidades.valor("hambre") < 80) { a.restante = 2; return; }
      return terminar(m, c);
    }
    case "beber": {
      if (!hayAgua(m, c.x, c.z, 2.4)) return terminar(m, c);
      c.necesidades.reponer("sed", 30);
      if (c.necesidades.valor("sed") >= 95) return terminar(m, c);
      a.restante = 2.5;
      return;
    }
    case "dormir": {
      if (!c.dormido) {
        c.dormido = true;
        a.datos.techo = !!m.refugioEn(c.x, c.z);
      }
      if (c.temperatura < 34.8) {
        c.dormido = false;
        recordar(m, c, "durmio_mal", -6, "Me desperté helado", 0.6);
        const cal = calentarse(m, c);
        if (cal) { soltarTarea(m, c); c.actividad = cal; return; }
        return terminar(m, c);
      }
      const madrugador = tiene(c, "madrugador") && m.ciclo.fase.nombre === "amanecer";
      const noct = tiene(c, "noctambulo") && m.esNoche;
      if (c.necesidades.valor("energia") >= 98 || madrugador || (noct && c.necesidades.valor("energia") > 60) || (tiene(c, "insomne") && m.azar.prob(0.004))) {
        if (a.datos.techo) recordar(m, c, "durmio_bien", 4, "Dormí bajo techo", 0.6);
        else recordar(m, c, "durmio_mal", -5, "Dormí a la intemperie", 0.6);
        c.dormido = false;
        return terminar(m, c);
      }
      if (tiene(c, "sonambulo") && m.azar.prob(0.002)) {
        c.dormido = false;
        c.actividad = nueva(m, "sonambulo", { ...m.lugarLibre({ cerca: c, radio: 10 }), alcance: 1 }, { restante: 4 });
        m.emitir("sonambulo", `${c.nombre} camina dormido…`, { x: c.x, z: c.z, actores: [c.id], interes: 1, tribu: c.tribu });
        return;
      }
      a.restante = 1;
      return;
    }
    case "sonambulo":
      return terminar(m, c);
    case "calentarse":
      if (c.temperatura > 36.6) return terminar(m, c);
      a.restante = 3;
      return;
    case "ocio":
    case "jugar": {
      c.necesidades.reponer("ocio", 25);
      if (a.datos.modo === "estrellas") recordar(m, c, "historia", 1, "Miré las estrellas", 0.3);
      if (a.datos.modo === "templo") recordar(m, c, "obra_terminada", 5, "Encontré paz en el templo", 1);
      return terminar(m, c);
    }
    case "charlar":
      c.necesidades.reponer("social", 10);
      return terminar(m, c);
    case "construir":
      return construir(m, c, a);
    case "sembrar": {
      const e = m.estructuras.get(a.objetivo ?? "");
      if (e && e.cultivo === 0) { e.cultivo = 0.02; ganarXp(m, c, "cultivo", 10); }
      return terminar(m, c, true);
    }
    case "cosechar": {
      const e = m.estructuras.get(a.objetivo ?? "");
      if (e && e.cultivo >= 1) {
        const n = Math.round((6 + Math.floor(m.azar.siguiente() * 5)) * destreza(c, "cultivo") * bonoMejora(t, "cultivar"));
        c.carga.verdura = (c.carga.verdura ?? 0) + n;
        e.cultivo = 0;
        ganarXp(m, c, "cultivo", 15);
        m.emitir("cosecha", `${c.nombre} cosecha ${n} verduras.`, { x: e.x, z: e.z, actores: [c.id], interes: 1, tribu: c.tribu });
        return irADepositar(m, c, true);
      }
      return terminar(m, c, true);
    }
    case "cocinar": case "fabricar": {
      const r = RECETA_POR_ID.get(String(a.datos.receta));
      if (!r || !t || !m.hay(t, r.ingredientes)) return terminar(m, c, true);
      for (const [o, n] of Object.entries(r.ingredientes)) m.sacar(t, o, n);
      for (const [o, n] of Object.entries(r.da)) m.meter(t, o, n);
      const h = a.tipo === "cocinar" ? "cocina" : "artesania";
      ganarXp(m, c, h, 12);
      a.hechas++;
      if (a.tipo === "fabricar") {
        m.emitir("fabrica", `${c.nombre} fabrica ${OBJETOS.get(Object.keys(r.da)[0])!.nombre}.`, { x: c.x, z: c.z, actores: [c.id], interes: 1, tribu: c.tribu });
        recordar(m, c, "trabajo_hecho", 2, "Fabriqué algo útil", 0.5);
        return terminar(m, c, true);
      }
      if (a.hechas >= 4 || !m.hay(t, r.ingredientes)) return terminar(m, c, true);
      a.restante = r.segundos / destreza(c, h);
      return;
    }
    case "avivar": {
      const e = m.estructuras.get(a.objetivo ?? "");
      if (!e || !t) return terminar(m, c, true);
      const def = ESTRUCTURAS.get(e.tipo)!.fuego!;
      const n = m.sacar(t, "madera", Math.min(8, Math.ceil((def.max - e.combustible) / def.porMadera)));
      e.combustible = Math.min(def.max, e.combustible + n * def.porMadera);
      return terminar(m, c, true);
    }
    case "curar": {
      const p = m.colonos.get(a.objetivo ?? "");
      if (!p || !p.vivo) return terminar(m, c, true);
      let bono = 1;
      if (t && m.sacar(t, "vendas", 1)) bono = 2;
      else if (t && m.sacar(t, "hierbas", 1)) bono = 1.5;
      p.vida = Math.min(100, p.vida + 6 * destreza(c, "medicina") * bono);
      if (p.derribado) {
        // Quien cuida a un herido en el suelo le da de beber, de comer y lo abriga.
        p.necesidades.reponer("sed", 35);
        if (t) for (const o of PREFERENCIA) if (m.sacar(t, o, 1)) { p.necesidades.reponer("hambre", valorComida(o)); break; }
        p.temperatura = Math.min(37, p.temperatura + 1.2);
      }
      p.stats.atendidoHasta = m.tick + Math.round(m.ticksDia * 0.3);
      if (p.enfermedad) p.enfermedad.inmunidad += 0.08 * destreza(c, "medicina");
      ganarXp(m, c, "medicina", 12);
      a.hechas++;
      if (p.vida >= 85 && !p.enfermedad || a.hechas >= 5) {
        p.memoria.cambiarRelacion(c.id, 8);
        recordar(m, p, "regalo", 4, `${c.nombre} me curó`, 1, c.id);
        return terminar(m, c, true);
      }
      a.restante = 4;
      return;
    }
    case "vigilar":
      if (!m.esNoche && m.ciclo.fase.nombre !== "atardecer") return terminar(m, c, true);
      if (caidoCerca(m, c) || c.necesidades.valor("sed") < 35 || c.necesidades.valor("hambre") < 30) return terminar(m, c);
      ganarXp(m, c, "combate", 2);
      a.restante = 5;
      return;
    case "investigar": {
      const e = m.estructuras.get(a.objetivo ?? "");
      if (!e || !t || !t.investigando) return terminar(m, c, true);
      const lugar = ESTRUCTURAS.get(e.tipo)!.saber ?? 1;
      aportar(m, t, 2.2 * lugar * destreza(c, "saber") * stat(c, "aprendizaje"));
      ganarXp(m, c, "saber", 10);
      a.hechas++;
      if (a.hechas >= 6 || m.esNoche) return terminar(m, c, true);
      a.restante = 6;
      return;
    }
    case "apagar": {
      const f = m.incendios.get(a.objetivo ?? "");
      if (!f) return terminar(m, c, true);
      f.intensidad -= 0.35 * stat(c, "trabajo");
      if (f.intensidad <= 0) {
        m.incendios.delete(a.objetivo!);
        return terminar(m, c, true);
      }
      a.restante = 1.5;
      return;
    }
    case "cazar": case "pelear":
      return combate(m, c, a);
    case "incursion":
      return incursion(m, c, a);
    case "asediar":
      return golpearMuro(m, c, a);
    case "comerciar":
      return comerciar(m, c, a);
    case "prender": {
      const k = `${Math.floor(c.x)},${Math.floor(c.z)}`;
      m.incendios.set(k, { x: Math.floor(c.x) + 0.5, z: Math.floor(c.z) + 0.5, intensidad: 1 });
      m.emitir("incendio", `${c.nombre} prende fuego cerca del poblado…`, { x: c.x, z: c.z, actores: [c.id], interes: 3, tribu: c.tribu });
      return terminar(m, c);
    }
    default:
      return terminar(m, c);
  }
}

function irADepositar(m: Mundo, c: Colono, tareaHecha: boolean): void {
  const t = m.tribus.get(c.tribu);
  const id = c.actividad?.tarea;
  if (id && tareaHecha) m.tareas.delete(id);
  else soltarTarea(m, c);
  if (!t) { c.actividad = null; return; }
  // Al punto de entrega más cercano que reciba lo que lleva (campamento, molino, almacén, centro urbano).
  const e = m.entregaPara(t, c.x, c.z, Object.keys(c.carga));
  const a = e ?? m.almacenDe(t);
  const radio = e ? ESTRUCTURAS.get(e.tipo)!.radio + 1 : 2.2;
  c.actividad = nueva(m, "depositar", { x: a.x, z: a.z, alcance: radio }, { restante: 0.6, datos: { donde: e?.tipo ?? "almacen" } });
}

/** Grado de la herramienta que lleva para un trabajo (0 = a mano). */
export function gradoDe(c: Colono, trabajo: string): number {
  const h = c.equipo.herramienta ? OBJETOS.get(c.equipo.herramienta)?.herramienta : undefined;
  return h && h.para === trabajo ? h.grado : 0;
}

/** En el almacén cambia lo que lleva por lo mejor que haya: arma, armadura, herramienta y abrigo. */
function equiparse(m: Mundo, c: Colono, t: Tribu): void {
  const cambiar = (slot: "arma" | "armadura" | "herramienta", candidatos: string[], valor: (o: string) => number): void => {
    let mejor = c.equipo[slot];
    let mv = mejor ? valor(mejor) : 0;
    for (const o of candidatos) if ((t.almacen[o] ?? 0) > 0 && valor(o) > mv) { mejor = o; mv = valor(o); }
    if (mejor && mejor !== c.equipo[slot]) {
      m.sacar(t, mejor, 1);
      if (c.equipo[slot]) m.meter(t, c.equipo[slot]!, 1);
      c.equipo[slot] = mejor;
    }
  };
  if (!tiene(c, "pacifista")) cambiar("arma", ARMAS, (o) => OBJETOS.get(o)!.arma!.danio);
  cambiar("armadura", ARMADURAS, (o) => OBJETOS.get(o)!.armadura!);
  const para = gusto(c, "minar") > gusto(c, "talar") ? "minar" : "talar";
  cambiar("herramienta", [...OBJETOS.values()].filter((o) => o.herramienta?.para === para).map((o) => o.id), (o) => OBJETOS.get(o)!.herramienta!.grado);
  const frioVestir = m.estacion === "otoño" || m.estacion === "invierno" || tieneRasgo(c, "friolero") || m.temperaturaEn(c.x, c.z) < 8;
  if (frioVestir && c.equipo.ropa !== "abrigo" && m.sacar(t, "abrigo", 1)) {
    if (c.equipo.ropa) m.meter(t, c.equipo.ropa, 1);
    c.equipo.ropa = "abrigo";
  } else if (frioVestir && !c.equipo.ropa && m.sacar(t, "manta", 1)) c.equipo.ropa = "manta";
}

function construir(m: Mundo, c: Colono, a: Actividad): void {
  const e = m.estructuras.get(a.objetivo ?? "");
  const t = m.tribus.get(c.tribu);
  if (!e || e.progreso >= 1 || !t) return terminar(m, c, true);
  const def = ESTRUCTURAS.get(e.tipo)!;
  const falta = Object.entries(def.costo).filter(([o, n]) => (e.entregado[o] ?? 0) < n);
  if (falta.length) {
    // ¿Trae materiales? entrégalos; si no, ve al almacén a buscarlos.
    let entrego = false;
    for (const [o, n] of falta) {
      const lleva = c.carga[o] ?? 0;
      if (lleva > 0) {
        const pone = Math.min(lleva, n - (e.entregado[o] ?? 0));
        e.entregado[o] = (e.entregado[o] ?? 0) + pone;
        c.carga[o] -= pone;
        if (c.carga[o] <= 0) delete c.carga[o];
        entrego = true;
      }
    }
    if (entrego) { a.restante = 0.5; return; }
    const almacen = m.almacenDe(t);
    if (dist(c, almacen) > 2.5 && a.datos.buscando !== true) {
      a.datos.buscando = true;
      a.destino = { ...almacen, alcance: 2.2 };
      a.camino = [];
      a.recalculo = -999;
      a.restante = 0.4;
      return;
    }
    let tomo = false;
    let cap = capacidad(c);
    for (const [o, n] of falta) {
      const toma = m.sacar(t, o, Math.min(cap, n - (e.entregado[o] ?? 0)));
      if (toma > 0) { c.carga[o] = (c.carga[o] ?? 0) + toma; cap -= toma; tomo = true; }
    }
    if (!tomo) return terminar(m, c); // no hay materiales: que el consejo pida más
    a.datos.buscando = false;
    a.destino = { x: e.x, z: e.z, alcance: def.radio + 0.8 };
    a.camino = [];
    a.recalculo = -999;
    a.restante = 0.4;
    return;
  }
  e.progreso = Math.min(1, e.progreso + (1 / def.trabajo) * destreza(c, "construccion") * bonoMejora(m.tribus.get(c.tribu), "construir"));
  ganarXp(m, c, "construccion", 3);
  if (e.progreso >= 1) return terminarObra(m, c, e.id);
  a.restante = 1;
}

export function terminarObra(m: Mundo, c: Colono | null, id: string): void {
  const e = m.estructuras.get(id)!;
  const def = ESTRUCTURAS.get(e.tipo)!;
  e.progreso = 1;
  if (def.fuego) e.combustible = def.fuego.inicial;
  const t = e.tribu ? m.tribus.get(e.tribu) : undefined;
  if (def.muro || HUELLAS[e.tipo]) m.recalcularTrazado();
  if (e.tipo === "maravilla" && t) {
    m.emitir("maravilla", `¡${t.nombre} termina una maravilla! Su nombre se recordará por siglos.`, { x: e.x, z: e.z, interes: 3, tribu: t.id });
    for (const c of m.miembros(t.id)) recordar(m, c, "obra_terminada", 15, "Nuestra maravilla está terminada", 4);
  }
  if (def.muro && e.tribu) {
    // La piedra reemplaza a la madera en el mismo tramo.
    for (const o of [...m.estructuras.values()]) if (o.id !== e.id && o.tribu === e.tribu && ESTRUCTURAS.get(o.tipo)!.muro && Math.hypot(o.x - e.x, o.z - e.z) < 1.2) m.quitarEstructura(o.id);
  }
  if (def.camas && t && VIVIENDAS.includes(e.tipo as (typeof VIVIENDAS)[number])) {
    // Una vivienda mejor reemplaza a la peor si ya hay camas de sobra.
    const camas = [...m.estructuras.values()].filter((o) => o.tribu === t.id && o.progreso >= 1).reduce((s, o) => s + (ESTRUCTURAS.get(o.tipo)!.camas ?? 0), 0);
    const vieja = [...m.estructuras.values()].filter((o) => o.tribu === t.id && o.id !== e.id && o.progreso >= 1 && VIVIENDAS.indexOf(o.tipo as (typeof VIVIENDAS)[number]) > VIVIENDAS.indexOf(e.tipo as (typeof VIVIENDAS)[number])).pop();
    if (vieja && camas - (ESTRUCTURAS.get(vieja.tipo)!.camas ?? 0) >= m.miembros(t.id).length) {
      const ocupantes = vieja.ocupantes;
      m.quitarEstructura(vieja.id);
      for (const id of ocupantes) { const o = m.colonos.get(id); if (o) o.cama = null; }
      m.emitir("renovacion", `${t.nombre} derriba una vieja ${ESTRUCTURAS.get(vieja.tipo)!.nombre} para vivir mejor.`, { x: vieja.x, z: vieja.z, interes: 1, tribu: t.id });
    }
  }
  if (def.camas && t) {
    // Asigna camas a quien no tiene.
    for (const o of m.miembros(t.id)) {
      if (e.ocupantes.length >= def.camas) break;
      if (!o.cama) { o.cama = e.id; e.ocupantes.push(o.id); }
    }
  }
  if (c) {
    if (c.actividad?.tarea) m.tareas.delete(c.actividad.tarea);
    for (const [tid, ta] of m.tareas) if (ta.objetivo === id && ta.tipo === "construir") m.tareas.delete(tid);
    for (const o of m.miembros(c.tribu)) if (dist(o, e) < 8) recordar(m, o, "obra_terminada", o.id === c.id ? 5 : 2, `Terminamos ${def.nombre === "huerto" ? "un huerto" : `la ${def.nombre}`}`, 1);
    c.actividad = null;
  }
  m.emitir("obra", `${t?.nombre ?? "Alguien"} termina ${["casa de piedra", "choza", "fogata", "empalizada", "torre de vigía"].includes(def.nombre) ? `una ${def.nombre}` : `un ${def.nombre}`}.`, { x: e.x, z: e.z, actores: c ? [c.id] : [], interes: e.tipo === "casa" || e.tipo === "totem" ? 2 : e.tipo === "empalizada" ? 0 : 1, tribu: e.tribu ?? undefined, datos: { tipo: e.tipo } });
}

// ------------------------------------------------------------ combate

function combate(m: Mundo, c: Colono, a: Actividad): void {
  const id = a.objetivo ?? "";
  const animal = m.animales.get(id);
  const enemigo = m.colonos.get(id);
  if (!animal && (!enemigo || !enemigo.vivo)) {
    // Si cazó, ir a desollar el cadáver más cercano.
    if (a.tipo === "cazar") {
      const cadaver = [...m.cuerpos.values()].find((k) => k.tipo === "animal" && dist(k, c) < 6);
      if (cadaver) {
        for (const [o, n] of Object.entries(cadaver.contenido)) c.carga[o] = (c.carga[o] ?? 0) + Math.round(n * (0.8 + destreza(c, "caza") * 0.3));
        m.cuerpos.delete(cadaver.id);
        return irADepositar(m, c, true);
      }
    }
    return terminar(m, c, true);
  }
  if (enemigo && enemigo.derribado) {
    // Rematar o perdonar: según rasgos.
    if (tiene(c, "sanguinario") || (tiene(c, "belicoso") && m.azar.prob(0.5))) {
      enemigo.ultimoDanio = c.id;
      daniar(m, enemigo, 100, c.id);
    }
    return terminar(m, c, true);
  }
  if (c.cooldownGolpe > 0) { a.restante = 0.2; return; }
  golpe(m, c, id);
  a.restante = 0.2;
}

/** Un golpe de un colono a un animal o a otro colono. */
export function golpe(m: Mundo, c: Colono, id: string): void {
  const arma = c.equipo.arma ? OBJETOS.get(c.equipo.arma)!.arma : undefined;
  const danio = (arma?.danio ?? 4) * stat(c, "fuerza") * (0.7 + destreza(c, "combate") * 0.35) * m.azar.rango(0.8, 1.2)
    * bonoMejora(m.tribus.get(c.tribu), (arma?.alcance ?? 1.5) > 3 ? "danio_distancia" : "danio_cuerpo");
  c.cooldownGolpe = arma?.cadencia ?? 1.3;
  c.stats.combo = ((c.stats.combo ?? 0) + 1) % 3;
  if (c.equipo.arma === "arcabuz") m.emitir("disparo", `¡Retumba un arcabuz de ${m.tribus.get(c.tribu)?.nombre ?? "alguien"}!`, { x: c.x, z: c.z, actores: [c.id], interes: 1, tribu: c.tribu });
  ganarXp(m, c, c.actividad?.tipo === "cazar" ? "caza" : "combate", 4);
  // A distancia: la flecha o la bala vuela de verdad (puede fallar o darle a otro).
  if ((arma?.alcance ?? 1.5) > 3) {
    const p = objetivoPos(m, id);
    if (p) disparar(m, c, p.x, p.z, danio, c.equipo.arma === "arcabuz" ? "bala" : "flecha");
    return;
  }
  impacto(m, c, id, danio);
}

/** Aplica un golpe (cuerpo a cuerpo o proyectil que llegó). El defensor puede esquivar o bloquear. */
export function impacto(m: Mundo, c: Colono, id: string, danio: number): void {
  const b = m.animales.get(id);
  if (b) {
    b.vida -= danio;
    b.ultimoAtacante = c.id;
    const esp = ESPECIES.get(b.especie)!;
    if (esp.conducta === "presa") { b.estado = "huir"; b.panico = 5; }
    else { b.estado = "cazar"; b.objetivo = c.id; }
    if (b.vida <= 0) {
      matarAnimal(m, b);
      recordar(m, c, "mato_animal", -1, `Maté un ${b.especie}`, 0.5);
      c.stats.cazas = (c.stats.cazas ?? 0) + 1;
      m.emitir("caza", `${c.nombre} caza un ${b.especie}.`, { x: b.cuerpo.x, z: b.cuerpo.y, actores: [c.id], interes: b.especie === "oso" || b.especie === "lobo" ? 2 : 1, tribu: c.tribu, datos: { especie: b.especie } });
    }
    return;
  }
  const v = m.colonos.get(id);
  if (!v || !v.vivo) return;
  if (!v.memoria.obtener(`peleo:${c.id}`)) {
    v.memoria.fijar(`peleo:${c.id}`, true);
    const ta = m.tribus.get(c.tribu), tv = m.tribus.get(v.tribu);
    m.emitir("ataque", c.tribu === v.tribu ? `¡${c.nombre} y ${v.nombre} se pelean!` : `¡${c.nombre} (${ta?.nombre}) ataca a ${v.nombre} (${tv?.nombre})!`, { x: v.x, z: v.z, actores: [c.id, v.id], interes: 3, tribu: c.tribu });
  }
  v.memoria.cambiarRelacion(c.id, -8);
  recordar(m, v, "pelea", -4, `${c.nombre} me atacó`, 1, c.id);
  // Reacción: esquivar (ágil y diestro), bloquear (con escudos) o encajar el golpe.
  const t = m.tribus.get(v.tribu);
  const cuerpo = dist(c, v) < 3.5;
  if (!v.derribado && !v.dormido && m.azar.prob(0.07 + 0.08 * (stat(v, "velocidad") - 0.8) + destreza(v, "combate") * 0.05)) {
    v.stats.reaccion = m.tick; v.stats.tipoReaccion = 1;
    return;
  }
  if (cuerpo && !v.derribado && v.equipo.arma && t?.conoce.includes("escudos") && m.azar.prob(0.3)) {
    v.stats.reaccion = m.tick; v.stats.tipoReaccion = 2;
    danio *= 0.25;
  } else {
    v.stats.reaccion = m.tick; v.stats.tipoReaccion = 3;
  }
  // La víctima responde si puede.
  if (!v.derribado && v.actividad?.tipo !== "pelear" && !v.crisis && valiente(v)) {
    soltarTarea(m, v);
    v.dormido = false;
    v.actividad = nueva(m, "pelear", { x: c.x, z: c.z, alcance: alcance(v) }, { objetivo: c.id });
  }
  daniar(m, v, danio, c.id);
  if (v.vivo) alarma(m, v, c.id);
}

// ------------------------------------------------------------ incursiones y comercio

/** El camino al objetivo está cortado por murallas: se ataca el tramo (o la puerta) más cercano. */
function asediar(m: Mundo, c: Colono, a: Actividad): boolean {
  const enemiga = String(a.datos.tribu ?? "");
  let mejor: { id: string; x: number; z: number } | null = null, md = 45;
  for (const e of m.estructurasCerca(c.x, c.z, 45)) {
    if (e.tribu !== enemiga || !ESTRUCTURAS.get(e.tipo)?.muro || e.progreso < 1) continue;
    const d = dist(e, c);
    if (d < md) { md = d; mejor = e; }
  }
  if (!mejor) return false;
  c.actividad = nueva(m, "asediar", { x: mejor.x, z: mejor.z, alcance: 2.2 }, { objetivo: mejor.id, restante: 1.4, datos: { ...a.datos } });
  return true;
}

function golpearMuro(m: Mundo, c: Colono, a: Actividad): void {
  const e = m.estructuras.get(a.objetivo ?? "");
  if (!e) {
    // Muro abajo: sigue el asalto hacia el objetivo.
    c.actividad = nueva(m, "incursion", { x: Number(a.datos.x ?? c.x), z: Number(a.datos.z ?? c.z), alcance: 2.5 }, { datos: { ...a.datos } });
    return;
  }
  const arma = c.equipo.arma ? OBJETOS.get(c.equipo.arma)!.arma : undefined;
  e.vida -= (arma?.danio ?? 4) * 0.6 * stat(c, "fuerza");
  ganarXp(m, c, "combate", 2);
  if (e.vida <= 0) {
    const t = m.tribus.get(e.tribu ?? "");
    m.emitir("derrumbe", `¡${m.tribus.get(c.tribu)?.nombre ?? "Alguien"} derriba ${e.tipo === "puerta" || e.tipo === "portal" ? "la puerta" : "un tramo de muralla"} de ${t?.nombre ?? "un pueblo"}!`, { x: e.x, z: e.z, interes: 3, tribu: c.tribu });
    m.quitarEstructura(e.id);
  }
  a.restante = 1.4;
}

function incursion(m: Mundo, c: Colono, a: Actividad): void {
  const objetivo = m.tribus.get(String(a.datos.tribu));
  const propia = m.tribus.get(c.tribu);
  if (!objetivo || !propia) return terminar(m, c, true);
  if (a.datos.volviendo) return irADepositar(m, c, true);
  // Saquea el almacén enemigo.
  let robado = 0;
  const cap = capacidad(c);
  const valiosos = Object.entries(objetivo.almacen).sort((x, y) => valorComida(y[0]) + (OBJETOS.get(y[0])?.arma ? 20 : 0) - valorComida(x[0]) - (OBJETOS.get(x[0])?.arma ? 20 : 0));
  for (const [o] of valiosos) {
    if (robado >= cap) break;
    const n = m.sacar(objetivo, o, cap - robado);
    c.carga[o] = (c.carga[o] ?? 0) + n;
    robado += n;
  }
  const sigilo = !!a.datos.sigilo;
  if (robado > 0) {
    objetivo.relaciones[propia.id] = Math.max(-100, (objetivo.relaciones[propia.id] ?? 0) - (sigilo ? 8 : 15));
    m.emitir(sigilo ? "hurto" : "saqueo", sigilo ? `${c.nombre} roba del almacén de ${objetivo.nombre}.` : `${c.nombre} saquea el almacén de ${objetivo.nombre} (${robado} cosas).`, { x: c.x, z: c.z, actores: [c.id], interes: 3, tribu: c.tribu, datos: { victima: objetivo.id } });
    for (const v of m.miembros(objetivo.id)) recordar(m, v, "robado", -6, `${propia.nombre} nos robó`, 1.5);
    contagiarIdea(m, objetivo, propia, 0.15);
    recordar(m, c, "victoria", 5, "Volví con el botín", 1);
  }
  a.datos.volviendo = true;
  irADepositar(m, c, true);
}

/** Camino entre dos pueblos que comercian (se traza una sola vez). */
function trazarRuta(m: Mundo, a: Tribu, b: Tribu): void {
  const id = `ruta:${[a.id, b.id].sort().join(":")}`;
  if (m.caminos.has(id)) return;
  const puntos: Array<[number, number]> = [[a.centro.x, a.centro.z]];
  let x = a.centro.x, z = a.centro.z;
  for (let tramo = 0; tramo < 12 && Math.hypot(b.centro.x - x, b.centro.z - z) > 6; tramo++) {
    const c = m.camino(x, z, b.centro.x, b.centro.z);
    if (!c || !c.length) break;
    for (const p of c) puntos.push(p);
    [x, z] = c[c.length - 1];
  }
  if (puntos.length > 2) {
    m.agregarCamino(id, puntos, null);
    m.emitir("ruta", `Se abre un camino de comercio entre ${a.nombre} y ${b.nombre}.`, { x: a.centro.x, z: a.centro.z, interes: 1 });
  }
}

function comerciar(m: Mundo, c: Colono, a: Actividad): void {
  const otra = m.tribus.get(String(a.datos.tribu));
  const propia = m.tribus.get(c.tribu);
  if (!otra || !propia || otra.extinta) return terminar(m, c, true);
  // Entrega lo que lleva y recibe lo que al otro le sobra.
  const llevado = cargaTotal(c);
  for (const [o, n] of Object.entries(c.carga)) m.meter(otra, o, n);
  c.carga = {};
  let recibe = 0;
  const sobrante = Object.entries(otra.almacen).sort((x, y) => y[1] - x[1]);
  for (const [o, n] of sobrante) {
    if (recibe >= llevado) break;
    const toma = m.sacar(otra, o, Math.min(n - 5, llevado - recibe));
    if (toma > 0) { c.carga[o] = (c.carga[o] ?? 0) + toma; recibe += toma; }
  }
  contagiarIdea(m, otra, propia, 0.35);
  contagiarIdea(m, propia, otra, 0.25);
  trazarRuta(m, propia, otra);
  otra.relaciones[propia.id] = Math.min(100, (otra.relaciones[propia.id] ?? 0) + 8);
  propia.relaciones[otra.id] = Math.min(100, (propia.relaciones[otra.id] ?? 0) + 6);
  ganarXp(m, c, "social", 20);
  if (llevado > 0 || recibe > 0) m.emitir("comercio", `${c.nombre} comercia con ${otra.nombre}: entrega ${llevado} y recibe ${recibe}.`, { x: c.x, z: c.z, actores: [c.id], interes: 2, tribu: c.tribu });
  irADepositar(m, c, true);
}

// ------------------------------------------------------------ crisis

function crisis(m: Mundo, c: Colono, dt: number): void {
  if (c.necesidades.valor("sed") < 15 || c.necesidades.valor("hambre") < 12) {
    c.crisis = null;
    c.actividad = null;
    return;
  }
  const tipo = c.crisis!.tipo;
  const t = m.tribus.get(c.tribu);
  if (!c.actividad) {
    switch (tipo) {
      case "furia": {
        const victima = [...m.colonos.values()].filter((o) => o.vivo && o.id !== c.id && dist(o, c) < 25).sort((x, y) => dist(x, c) - dist(y, c))[0];
        c.actividad = victima ? nueva(m, "pelear", { x: victima.x, z: victima.z, alcance: 1.3 }, { objetivo: victima.id }) : nueva(m, "ir", { ...m.lugarLibre({ cerca: c, radio: 15 }), alcance: 1 });
        break;
      }
      case "huida":
        c.actividad = nueva(m, "huir", { ...m.lugarLibre({ cerca: c, radio: 45, evitar: t ? [t.centro] : [], minDist: 25 }), alcance: 1 });
        break;
      case "atracon":
        if (t) {
          const al = m.almacenDe(t);
          c.actividad = nueva(m, "comer", { x: al.x, z: al.z, alcance: 2.5 }, { restante: 1.5, datos: { de: "almacen" } });
        }
        break;
      case "robo":
        if (t) {
          const otra = [...m.tribus.values()].find((x) => x.id !== c.tribu && !x.extinta);
          if (otra) c.actividad = nueva(m, "incursion", { ...m.almacenDe(otra), alcance: 2 }, { datos: { tribu: otra.id, sigilo: true } });
        }
        break;
      case "incendio":
        c.actividad = nueva(m, "prender", { ...m.lugarLibre({ cerca: t?.centro ?? c, radio: 10 }), alcance: 1 }, { restante: 2 });
        break;
      default:
        c.actividad = nueva(m, tipo === "vagar" ? "ir" : "crisis", tipo === "vagar" ? { ...m.lugarLibre({ cerca: c, radio: 20 }), alcance: 1 } : null, { restante: 8 });
    }
    if (!c.actividad) c.actividad = nueva(m, "crisis", null, { restante: 8 });
  }
  if (c.actividad.tipo === "comer" && tipo === "atracon") c.necesidades.reponer("hambre", -20);
  ejecutar(m, c, dt);
}

