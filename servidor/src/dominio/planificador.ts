// El consejo de cada tribu: cada pocos segundos mira el almacén, la población, la estación, las amenazas, su
// árbol tecnológico y el plano del pueblo, y publica TAREAS en el tablero de la tribu (talar, minar, recolectar,
// cazar, sembrar, cosechar, cocinar, fundir, forjar, investigar, construir, curar, vigilar, avivar, apagar).
// Nadie asigna nada a nadie: cada colono elige del tablero según su habilidad, sus rasgos y su ánimo.
//
// El PUEBLO se planifica: plaza con fogata, pozo y tótem; un anillo de oficios; barrios de viviendas a lo largo
// de cuatro calles que salen hacia cuatro puertas; huertos fuera; y una muralla en anillo (empalizada y, con
// Fortificación, piedra).

import { esYacimiento, recibe, YACIMIENTOS } from "./catalogo.ts";
import { ARMAS, ARMADURAS, ESPECIES, ESTRUCTURAS, MINERALES, NODOS, OBJETOS, PLAN_ASENTAMIENTO, RECETAS, VIVIENDAS, type DefReceta } from "./catalogo.ts";
import type { Trabajo } from "./datos/esquema.ts";
import { HZ, dist, type Mundo } from "./mundo.ts";
import { era, sabe } from "./tecnologia.ts";
import { caminable } from "./terreno.ts";
import type { Estructura, Tarea, Tribu } from "./tipos.ts";

export const valorComida = (o: string): number => OBJETOS.get(o)?.comida?.hambre ?? 0;

export function comidaDe(t: Tribu): number {
  return Object.entries(t.almacen).reduce((s, [o, n]) => s + valorComida(o) * n, 0);
}

function crearTarea(m: Mundo, t: Tribu, trabajo: Trabajo, tipo: string, objetivo: string | null, x: number, z: number, prioridad: number, datos: Record<string, unknown> = {}): Tarea {
  const ta: Tarea = { id: m.nuevoId("t"), tribu: t.id, trabajo, tipo, objetivo, x, z, prioridad, asignado: null, creada: m.tick, datos };
  m.tareas.set(ta.id, ta);
  return ta;
}

function abiertas(m: Mundo, t: Tribu, tipo: string): Tarea[] {
  return [...m.tareas.values()].filter((x) => x.tribu === t.id && x.tipo === tipo);
}

function yaHay(m: Mundo, t: Tribu, tipo: string, objetivo: string | null): boolean {
  for (const x of m.tareas.values()) if (x.tribu === t.id && x.tipo === tipo && x.objetivo === objetivo) return true;
  return false;
}

export function estructurasDe(m: Mundo, t: Tribu, tipo?: string): Estructura[] {
  return [...m.estructuras.values()].filter((e) => e.tribu === t.id && (!tipo || e.tipo === tipo));
}

export const terminadas = (m: Mundo, t: Tribu, tipo: string): Estructura[] => estructurasDe(m, t, tipo).filter((e) => e.progreso >= 1);

// ------------------------------------------------------------ plano del pueblo

/** Ángulos de las cuatro calles principales. */
export function calles(t: Tribu): number[] {
  return [0, 1, 2, 3].map((k) => t.giro + (k * Math.PI) / 2);
}

/** ¿El punto cae sobre una calle (radial o el anillo de la plaza)? */
function enCalle(t: Tribu, x: number, z: number, margen: number): boolean {
  const dx = x - t.centro.x, dz = z - t.centro.z;
  const r = Math.hypot(dx, dz);
  if (Math.abs(r - 9.5) < 1.1 + margen) return true;
  if (r < 4.5) return false;
  for (const a of calles(t)) {
    const ux = Math.cos(a), uz = Math.sin(a);
    const largo = dx * ux + dz * uz;
    if (largo < 0) continue;
    const lateral = Math.abs(-dx * uz + dz * ux);
    if (lateral < 1.4 + margen) return true;
  }
  return false;
}

const ZONA: Record<string, readonly [number, number]> = {
  fogata: [0, 0], pozo: [3.8, 6.5], totem: [3.8, 6.5], circulo: [5.5, 7.8],
  almacen: [5.5, 7.5], granero: [5.5, 7.5], taller: [5.5, 7.5], cocina: [5.5, 7.5], horno: [5.5, 7.5], forja: [5.5, 7.5],
  biblioteca: [12, 16], enfermeria: [12, 16], torre: [-3, -2],
  cuartel: [13, 99], galeria: [13, 99], mercado: [13, 18], templo: [13, 18], universidad: [13, 99], castillo: [14, 99], maravilla: [14, 99],
  choza: [11.5, 99], cabana: [11.5, 99], casa: [11.5, 99], casa_grande: [12.5, 99], centro: [13, 17.5],
  huerto: [3.5, 14],
};

function libre(m: Mundo, t: Tribu, x: number, z: number, radio: number): boolean {
  for (let dz = -Math.ceil(radio); dz <= Math.ceil(radio); dz++) {
    for (let dx = -Math.ceil(radio); dx <= Math.ceil(radio); dx++) {
      if (!caminable(m.terreno, Math.floor(x + dx), Math.floor(z + dz))) return false;
      if (m.bloqueo[Math.floor(z + dz) * m.config.tam + Math.floor(x + dx)] !== 0) return false;
    }
  }
  for (const e of m.estructuras.values()) {
    if (Math.hypot(e.x - x, e.z - z) < radio + (ESTRUCTURAS.get(e.tipo)?.radio ?? 1) + 0.7) return false;
  }
  if (m.yacimientosCerca(x, z, radio + 4.5).length) return false;
  return true;
}

/** Busca dónde poner una obra según el plano del pueblo. */
export function lugarObra(m: Mundo, t: Tribu, tipo: string, indice = 0): { x: number; z: number; rot: number } | null {
  const def = ESTRUCTURAS.get(tipo)!;
  if (def.muro) return lugarMuro(m, t, tipo, indice);
  if (tipo === "fogata" && estructurasDe(m, t, "fogata").length === 0) return { x: t.centro.x, z: t.centro.z, rot: t.giro };
  const [zmin0, zmax0] = ZONA[tipo] ?? [6, 14];
  const R = t.radioMuro;
  let rmin = zmin0, rmax = zmax0 >= 99 ? R - def.radio - 1.5 : zmax0;
  if (tipo === "torre") { rmin = R - 3; rmax = R - 2; }
  if (tipo === "huerto") { rmin = R + 4; rmax = R + 14; }
  if (tipo === "molino") { rmin = R + 7; rmax = R + 12; }
  const molino = tipo === "huerto" ? terminadas(m, t, "molino")[0] : undefined;
  if (molino) {
    // Granjas en anillo alrededor del molino.
    for (let r = 5.5; r <= 13; r += 2.5) {
      const pasos = Math.max(6, Math.round(r));
      for (let k = 0; k < pasos; k++) {
        const a = (k / pasos) * Math.PI * 2 + r;
        const x = molino.x + Math.cos(a) * r, z = molino.z + Math.sin(a) * r;
        if (!libre(m, t, x, z, def.radio)) continue;
        for (const n of m.nodosCerca(x, z, def.radio + 0.4)) {
          if (esYacimiento(n.tipo)) continue;
          if (n.nodo.restantes > 0 || !n.quemado) { n.nodo.restantes = 0; n.espera = 1e9; m.nodosCambiados.add(n.id); }
        }
        return { x, z, rot: Math.atan2(molino.x - x, molino.z - z) };
      }
    }
  }
  if (tipo === "biblioteca" || tipo === "enfermeria") { rmin = 11; rmax = Math.max(13, R - 4); }
  for (let r = Math.max(0, rmin); r <= Math.max(rmin, rmax) + 0.01; r += 1.2) {
    const pasos = Math.max(8, Math.round(r * 1.4));
    const giro = m.azar.siguiente() * Math.PI * 2;
    for (let k = 0; k < pasos; k++) {
      const a = giro + (k / pasos) * Math.PI * 2;
      const x = t.centro.x + Math.cos(a) * r, z = t.centro.z + Math.sin(a) * r;
      if (enCalle(t, x, z, def.radio * 0.6)) continue;
      if (!libre(m, t, x, z, def.radio)) continue;
      // Despeja árboles y rocas donde va la obra (quedan tocones).
      for (const n of m.nodosCerca(x, z, def.radio + 0.4)) {
        if (esYacimiento(n.tipo)) continue;
        if (n.nodo.restantes > 0 || !n.quemado) { n.nodo.restantes = 0; n.espera = 1e9; m.nodosCambiados.add(n.id); }
      }
      // Las casas miran hacia el centro (su puerta da a la plaza o a la calle).
      const rot = Math.atan2(t.centro.x - x, t.centro.z - z);
      return { x, z, rot };
    }
  }
  return null;
}

/** Tramo de muralla o puerta en el anillo del pueblo. */
function lugarMuro(m: Mundo, t: Tribu, tipo: string, _indice: number): { x: number; z: number; rot: number } | null {
  const R = t.radioMuro;
  const n = Math.max(24, Math.round((Math.PI * 2 * R) / 2));
  const puertas = calles(t);
  const esPuerta = ESTRUCTURAS.get(tipo)!.muro === "puerta";
  const posiciones: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const cercaPuerta = puertas.some((p) => Math.abs(Math.atan2(Math.sin(a - p), Math.cos(a - p))) < (Math.PI * 2) / n * 0.75);
    if (esPuerta === cercaPuerta) posiciones.push(a);
  }
  if (esPuerta) for (const p of puertas) if (!posiciones.includes(p)) posiciones.push(p);
  for (const a of (esPuerta ? puertas : posiciones)) {
    const x = t.centro.x + Math.cos(a) * R, z = t.centro.z + Math.sin(a) * R;
    if (!caminable(m.terreno, Math.floor(x), Math.floor(z))) continue;
    // ¿Ya hay un muro aquí? (se reemplaza empalizada por piedra en Fortificación)
    const hay = [...m.estructuras.values()].find((e) => e.tribu === t.id && ESTRUCTURAS.get(e.tipo)!.muro && Math.hypot(e.x - x, e.z - z) < 1.2);
    if (hay && (hay.tipo === tipo || hay.tipo === "muralla" || hay.tipo === "puerta")) continue;
    if (hay && !(tipo === "muralla" || tipo === "puerta")) continue;
    if (!hay && [...m.estructuras.values()].some((e) => !ESTRUCTURAS.get(e.tipo)!.muro && Math.hypot(e.x - x, e.z - z) < ESTRUCTURAS.get(e.tipo)!.radio + 1.3)) continue;
    if (m.yacimientosCerca(x, z, 4.5).length) continue;
    for (const nd of m.nodosCerca(x, z, 1.6)) { nd.nodo.restantes = 0; nd.espera = 1e9; m.nodosCambiados.add(nd.id); }
    return { x, z, rot: Math.PI / 2 - a };
  }
  return null;
}

/** Coloca un plano en un lugar libre cerca de (x, z), entre `rmin` y `rmax` metros. */
function colocarCerca(m: Mundo, t: Tribu, tipo: string, x: number, z: number, rmin: number, rmax: number): Estructura | null {
  const def = ESTRUCTURAS.get(tipo)!;
  for (let r = rmin; r <= rmax; r += 1.5) {
    const pasos = Math.max(8, Math.round(r * 1.2));
    const giro = Math.atan2(t.centro.z - z, t.centro.x - x);
    for (let k = 0; k < pasos; k++) {
      const a = giro + ((k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI * 2) / pasos;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!libre(m, t, px, pz, def.radio)) continue;
      for (const n of m.nodosCerca(px, pz, def.radio + 0.4)) {
        if (esYacimiento(n.tipo)) continue;
        if (n.nodo.restantes > 0 || !n.quemado) { n.nodo.restantes = 0; n.espera = 1e9; m.nodosCambiados.add(n.id); }
      }
      const e: Estructura = { id: m.nuevoId("e"), tipo, tribu: t.id, x: px, z: pz, rot: Math.atan2(x - px, z - pz), progreso: 0, entregado: {}, vida: def.vida, combustible: 0, cultivo: 0, ocupantes: [] };
      m.estructuras.set(e.id, e);
      return e;
    }
  }
  return null;
}

/** Campamentos maderero y minero donde la gente explota recursos lejos de un punto de entrega. */
function campamentos(m: Mundo, t: Tribu): void {
  const tipos: Array<[string, string]> = [["talar", "campamento_maderero"], ["minar", "campamento_minero"]];
  for (const [trabajo, camp] of tipos) {
    const propios = estructurasDe(m, t, camp);
    if (propios.some((e) => e.progreso < 1) || propios.length >= 4) continue;
    const def = ESTRUCTURAS.get(camp)!;
    for (const ta of abiertas(m, t, trabajo)) {
      const n = ta.objetivo ? m.nodos.get(ta.objetivo) : undefined;
      if (!n) continue;
      const recurso = NODOS.get(n.tipo)!.def.recurso;
      if (!recibe(def, recurso)) continue;
      // ¿Hay algún punto de entrega (terminado o en obra) que reciba esto a menos de 24 m?
      const cerca = [...m.estructuras.values()].some((e) => e.tribu === t.id && ESTRUCTURAS.get(e.tipo)!.entrega && recibe(ESTRUCTURAS.get(e.tipo)!, recurso) && Math.hypot(e.x - n.x, e.z - n.z) < 24);
      if (cerca) continue;
      const y = YACIMIENTOS[n.tipo];
      if (colocarCerca(m, t, camp, n.x, n.z, y ? y.radio + 5.5 : 4, y ? y.radio + 14 : 16)) return;
    }
  }
}

/** Coloca un plano de obra (sin materiales todavía). */
export function colocarPlano(m: Mundo, t: Tribu, tipo: string, indice = 0): Estructura | null {
  const lugar = lugarObra(m, t, tipo, indice);
  if (!lugar) return null;
  const def = ESTRUCTURAS.get(tipo)!;
  const e: Estructura = { id: m.nuevoId("e"), tipo, tribu: t.id, x: lugar.x, z: lugar.z, rot: lugar.rot, progreso: 0, entregado: {}, vida: def.vida, combustible: 0, cultivo: 0, ocupantes: [] };
  m.estructuras.set(e.id, e);
  return e;
}

/** Calles del pueblo (se trazan al fundarlo y crecen con la muralla). */
export function trazarCalles(m: Mundo, t: Tribu): void {
  for (const [id, c] of m.caminos) if (c.tribu === t.id && id.startsWith(`calle:${t.id}:`)) m.caminos.delete(id);
  const R = t.radioMuro + 8;
  calles(t).forEach((a, k) => {
    const puntos: Array<[number, number]> = [];
    for (let r = 3; r <= R; r += 2) {
      const x = t.centro.x + Math.cos(a) * r, z = t.centro.z + Math.sin(a) * r;
      if (!caminable(m.terreno, Math.floor(x), Math.floor(z))) break;
      puntos.push([x, z]);
    }
    if (puntos.length > 1) m.agregarCamino(`calle:${t.id}:${k}`, puntos, t.id);
  });
  const anillo: Array<[number, number]> = [];
  for (let k = 0; k <= 36; k++) {
    const a = (k / 36) * Math.PI * 2;
    anillo.push([t.centro.x + Math.cos(a) * 9.5, t.centro.z + Math.sin(a) * 9.5]);
  }
  m.agregarCamino(`calle:${t.id}:anillo`, anillo, t.id);
}

// ------------------------------------------------------------ limpieza del tablero

function limpiar(m: Mundo): void {
  for (const [id, ta] of m.tareas) {
    let viva = true;
    const o = ta.objetivo;
    switch (ta.tipo) {
      case "talar": case "minar": case "recolectar": { const n = o ? m.nodos.get(o) : undefined; viva = !!n && n.nodo.disponible && !n.quemado; break; }
      case "cazar": viva = !!o && m.animales.has(o); break;
      case "construir": { const e = o ? m.estructuras.get(o) : undefined; viva = !!e && e.progreso < 1; break; }
      case "sembrar": { const e = o ? m.estructuras.get(o) : undefined; viva = !!e && e.progreso >= 1 && e.cultivo === 0; break; }
      case "cosechar": { const e = o ? m.estructuras.get(o) : undefined; viva = !!e && e.cultivo >= 1; break; }
      case "curar": { const c = o ? m.colonos.get(o) : undefined; viva = !!c && c.vivo && (c.vida < 85 || !!c.enfermedad || c.derribado); break; }
      case "avivar": { const e = o ? m.estructuras.get(o) : undefined; viva = !!e && e.combustible < 900; break; }
      case "apagar": viva = !!o && m.incendios.has(o); break;
      case "investigar": { const t = m.tribus.get(ta.tribu); viva = !!t && !!t.investigando && m.estructuras.has(o ?? "") && m.tick - ta.creada < m.ticksDia * 0.5; break; }
      case "incursion": case "comerciar": viva = m.tick - ta.creada < m.ticksDia * 0.5; break;
      default: viva = m.tick - ta.creada < m.ticksDia * 0.4;
    }
    if (ta.asignado) {
      const c = m.colonos.get(ta.asignado);
      if (!c || !c.vivo || c.actividad?.tarea !== id) ta.asignado = null;
    }
    if (!viva) m.tareas.delete(id);
  }
}

function pedirNodos(m: Mundo, t: Tribu, trabajo: Trabajo, tipoNodo: string, max: number, prioridad: number, radio = 60, grado = 0): void {
  const tipo = NODOS.get(tipoNodo)!.trabajo;
  if (grado < NODOS.get(tipoNodo)!.def.herramienta) return;
  const ab = abiertas(m, t, tipo).filter((x) => m.nodos.get(x.objetivo ?? "")?.tipo === tipoNodo);
  for (const ta of ab) ta.prioridad = prioridad;
  if (ab.length >= max) return;
  const cerca = (esYacimiento(tipoNodo) ? m.yacimientosCerca(t.centro.x, t.centro.z, radio, (n) => n.tipo === tipoNodo && n.nodo.disponible) : m.nodosCerca(t.centro.x, t.centro.z, radio, (n) => n.tipo === tipoNodo && n.nodo.disponible && !n.quemado)).sort((a, b) => dist(a, t.centro) - dist(b, t.centro));
  let n = ab.length;
  for (const nd of cerca) {
    if (n >= max) break;
    const plazas = YACIMIENTOS[nd.tipo]?.plazas ?? 1;
    let ocupadas = 0;
    for (const x of m.tareas.values()) if (x.tribu === t.id && x.tipo === tipo && x.objetivo === nd.id) ocupadas++;
    for (; ocupadas < plazas && n < max; ocupadas++, n++) crearTarea(m, t, trabajo, tipo, nd.id, nd.x, nd.z, prioridad);
  }
}

/** Mejor grado de pico que tiene la tribu (en el almacén o en manos de alguien). */
function gradoPico(m: Mundo, t: Tribu): number {
  let g = 0;
  const mira = (o: string | null): void => { const h = o ? OBJETOS.get(o)?.herramienta : undefined; if (h?.para === "minar") g = Math.max(g, h.grado); };
  for (const o of Object.keys(t.almacen)) mira(o);
  for (const c of m.miembros(t.id)) mira(c.equipo.herramienta);
  return g;
}

function cuenta(m: Mundo, t: Tribu, o: string): number {
  return (t.almacen[o] ?? 0) + m.miembros(t.id).filter((c) => c.equipo.arma === o || c.equipo.herramienta === o || c.equipo.ropa === o || c.equipo.armadura === o).length;
}

/** Qué conviene fabricar ahora, según la tecnología, lo que falta y los lugares que tiene la tribu. */
function pedidoDeFabricacion(m: Mundo, t: Tribu, adultos: number): DefReceta | null {
  const conoce = (r: DefReceta): boolean => !r.tec || sabe(t, r.tec);
  const lugar = (r: DefReceta): boolean => terminadas(m, t, r.lugar === "fuego" ? "fogata" : r.lugar).length > 0;
  const puede = (id: string): DefReceta | null => {
    const r = RECETAS.find((x) => x.id === id);
    return r && conoce(r) && lugar(r) && m.hay(t, r.ingredientes) ? r : null;
  };
  // Metal: fundir primero.
  for (const id of ["lingote_hierro", "lingote_cobre", "polvora"]) {
    const r = puede(id);
    if (r && (t.almacen[id] ?? 0) < 8) return r;
  }
  // Armas: la mejor que se pueda, hasta armar a 3 de cada 4 adultos.
  const armados = ARMAS.reduce((s, a) => s + cuenta(m, t, a), 0);
  const mejoresArmas = ["arcabuz", "espada_hierro", "espada_cobre", "arco", "lanza"];
  if (armados < Math.ceil(adultos * 0.75)) for (const a of mejoresArmas) { const r = puede(a); if (r) return r; }
  // Mejorar armas viejas cuando ya hay algo mejor.
  for (const a of mejoresArmas.slice(0, 3)) { const r = puede(a); if (r && cuenta(m, t, a) < Math.ceil(adultos / 2)) return r; }
  // Armaduras.
  const blindados = ARMADURAS.reduce((s, a) => s + cuenta(m, t, a), 0);
  if (blindados < Math.ceil(adultos * 0.6)) for (const a of ["armadura_hierro", "armadura_cobre", "armadura_cuero"]) { const r = puede(a); if (r) return r; }
  // Ropa de abrigo: se prepara desde el verano (abrigo de piel o, si no hay pieles, manta de fibra).
  if (m.estacion !== "primavera" && cuenta(m, t, "abrigo") + cuenta(m, t, "manta") < m.miembros(t.id).length) {
    const r = puede("abrigo") ?? puede("manta");
    if (r) return r;
  }
  // Herramientas.
  for (const [hacha, pico] of [["hacha_hierro", "pico_hierro"], ["hacha_cobre", "pico_cobre"], ["hacha", "pico"]]) {
    if (cuenta(m, t, hacha) < Math.ceil(adultos / 3)) { const r = puede(hacha); if (r) return r; }
    if (cuenta(m, t, pico) < Math.ceil(adultos / 4)) { const r = puede(pico); if (r) return r; }
  }
  if ((t.almacen.vendas ?? 0) < 4) { const r = puede("vendas"); if (r) return r; }
  return null;
}

/** Mejor vivienda que conoce la tribu. */
export function mejorVivienda(t: Tribu): string {
  for (const v of VIVIENDAS) {
    const tec = ESTRUCTURAS.get(v)!.tec;
    if (!tec || sabe(t, tec)) return v;
  }
  return "choza";
}

/** Planifica una tribu. */
export function planificar(m: Mundo, t: Tribu): void {
  const miembros = m.miembros(t.id);
  const adultos = miembros.filter((c) => !m.esNino(c));
  const pob = miembros.length;
  if (!pob) return;
  const dias = (m.tick - t.fundada) / m.ticksDia;
  const invierno = m.estacion === "invierno";
  const obras = estructurasDe(m, t).filter((e) => e.progreso < 1);
  const muroAbierto = obras.filter((e) => ESTRUCTURAS.get(e.tipo)!.muro).length;
  const obrasAbiertas = obras.length - muroAbierto;

  // El pueblo crece: la muralla (si aún no existe) se plantea según la población.
  if (!estructurasDe(m, t).some((e) => ESTRUCTURAS.get(e.tipo)!.muro)) {
    const R = Math.max(18, Math.min(32, 12 + pob * 1.1));
    if (Math.abs(R - t.radioMuro) > 2) { t.radioMuro = R; trazarCalles(m, t); }
  }

  // 1) Viviendas: camas para todos con la mejor vivienda que se conozca.
  const camas = estructurasDe(m, t).reduce((s, e) => s + (ESTRUCTURAS.get(e.tipo)!.vivienda ? ESTRUCTURAS.get(e.tipo)!.camas ?? 0 : 0), 0);
  const viv = mejorVivienda(t);
  const basicos = ["fogata", "pozo", "almacen"].every((x) => estructurasDe(m, t, x).length > 0);
  let colocadas = 0;
  if (basicos && obrasAbiertas < (pob >= 8 ? 2 : 1) && camas < pob + 3 && camas < m.config.topePueblo) {
    if (colocarPlano(m, t, viv)) colocadas++;
  }
  // 2) Plan de asentamiento (oficios y servicios), con su tecnología.
  if (obrasAbiertas + colocadas < (pob >= 8 ? 3 : 2)) {
    for (const paso of PLAN_ASENTAMIENTO) {
      const def = ESTRUCTURAS.get(paso.tipo)!;
      if (dias < paso.desde || (def.tec && !sabe(t, def.tec)) || (def.edad ?? 1) > era(t)) continue;
      const hechas = estructurasDe(m, t, paso.tipo).length;
      if (hechas >= paso.cuantos(pob)) continue;
      if (Object.entries(def.costo).some(([o, n]) => o.startsWith("lingote") && (t.almacen[o] ?? 0) < n)) continue;
      if (colocarPlano(m, t, paso.tipo, hechas)) break;
    }
    // Renovar viviendas viejas (una a la vez) cuando sobra material y no hay obras abiertas.
    const peores = estructurasDe(m, t).filter((e) => e.progreso >= 1 && VIVIENDAS.indexOf(e.tipo as (typeof VIVIENDAS)[number]) > VIVIENDAS.indexOf(viv as (typeof VIVIENDAS)[number]));
    if (viv !== "choza" && peores.length && (t.almacen.madera ?? 0) > 70 && (t.almacen.piedra ?? 0) > 50 && estructurasDe(m, t).every((e) => e.progreso >= 1) && camas < pob * 1.5 + 2) colocarPlano(m, t, viv);
  }
  // 3) Murallas: empalizada con Carpintería; piedra con Fortificación.
  if (pob >= 6 && dias >= 2 && basicos && camas >= pob && muroAbierto < 3) {
    const fort = sabe(t, "fortificacion");
    if (sabe(t, "carpinteria")) {
      const puertaTipo = fort ? "puerta" : "portal";
      const muroTipo = fort ? "muralla" : "empalizada";
      if (!colocarPlano(m, t, puertaTipo)) colocarPlano(m, t, muroTipo);
    }
  }
  // Materiales que faltan para las obras abiertas, y tareas de construcción.
  const falta: Record<string, number> = {};
  for (const e of estructurasDe(m, t).filter((x) => x.progreso < 1)) {
    for (const [o, n] of Object.entries(ESTRUCTURAS.get(e.tipo)!.costo)) falta[o] = (falta[o] ?? 0) + Math.max(0, n - (e.entregado[o] ?? 0));
    const muro = !!ESTRUCTURAS.get(e.tipo)!.muro;
    for (let k = abiertas(m, t, "construir").filter((x) => x.objetivo === e.id).length; k < (muro ? 1 : 2); k++) {
      crearTarea(m, t, "construir", "construir", e.id, e.x, e.z, muro ? 2 : 3 + (e.tipo === "fogata" || e.tipo === "pozo" || VIVIENDAS.includes(e.tipo as (typeof VIVIENDAS)[number]) ? 1 : 0));
    }
  }

  // 4) Comida.
  const comida = comidaDe(t);
  const meta = pob * 70 * (sabe(t, "alfareria") ? 1.4 : 1) * (m.estacion === "otoño" || m.estacion === "invierno" ? 2.2 : m.estacion === "verano" ? 1.5 : 1);
  const hambre = Math.max(0, 1 - comida / meta);
  const pComida = 1.5 + hambre * 3.5;
  if (comida < meta * 1.3) pedirNodos(m, t, "recolectar", "arbusto", Math.ceil(adultos.length / 2) + (hambre > 0.5 ? 2 : 0), pComida);
  if (hambre > 0.2) {
    const ab = abiertas(m, t, "cazar");
    for (const ta of ab) ta.prioridad = pComida;
    if (ab.length < Math.max(1, Math.ceil(adultos.length / 3))) {
      const presas = [...m.animales.values()].filter((b) => (b.especie === "ciervo" || b.especie === "conejo" || (b.especie === "jabali" && pob > 4)) && Math.hypot(b.cuerpo.x - t.centro.x, b.cuerpo.y - t.centro.z) < 70)
        .sort((a, b) => ESPECIES.get(b.especie)!.vida - ESPECIES.get(a.especie)!.vida);
      for (const b of presas.slice(0, 2)) if (!yaHay(m, t, "cazar", b.id)) crearTarea(m, t, "cazar", "cazar", b.id, b.cuerpo.x, b.cuerpo.y, pComida);
    }
  }
  for (const h of terminadas(m, t, "huerto")) {
    if (h.cultivo === 0 && !invierno && !yaHay(m, t, "sembrar", h.id)) crearTarea(m, t, "cultivar", "sembrar", h.id, h.x, h.z, 2.5);
    if (h.cultivo >= 1 && !yaHay(m, t, "cosechar", h.id)) crearTarea(m, t, "cultivar", "cosechar", h.id, h.x, h.z, 3.5);
  }
  const fuegos = [...terminadas(m, t, "cocina"), ...terminadas(m, t, "fogata")].filter((e) => e.combustible > 0);
  if (fuegos.length) {
    const receta = RECETAS.filter((r) => r.lugar === "fuego" && (!r.tec || sabe(t, r.tec))).find((r) => m.hay(t, r.ingredientes));
    if (receta && abiertas(m, t, "cocinar").length < (pob > 6 ? 2 : 1)) crearTarea(m, t, "cocinar", "cocinar", fuegos[0].id, fuegos[0].x, fuegos[0].z, 2.5 + hambre * 2, { receta: receta.id });
  }

  // 5) Materiales y minerales.
  const necMadera = 50 + (falta.madera ?? 0) + (invierno ? 20 : 0);
  const necPiedra = 25 + (falta.piedra ?? 0);
  const necFibra = 14 + (falta.fibra ?? 0);
  const pMadera = 1 + Math.max(0, 1 - (t.almacen.madera ?? 0) / necMadera) * 2.5;
  const pPiedra = 0.8 + Math.max(0, 1 - (t.almacen.piedra ?? 0) / necPiedra) * 2.2;
  if ((t.almacen.madera ?? 0) < necMadera) pedirNodos(m, t, "talar", "arbol", Math.ceil(adultos.length / 2), pMadera);
  if ((t.almacen.piedra ?? 0) < necPiedra) pedirNodos(m, t, "minar", "roca", Math.ceil(adultos.length / 3), pPiedra, 220);
  if ((t.almacen.fibra ?? 0) < necFibra) pedirNodos(m, t, "recolectar", "hierbas", 2, 1.4);
  if (sabe(t, "mineria")) {
    const g = gradoPico(m, t);
    const quiere: Record<string, number> = { carbon: 20, cobre: sabe(t, "fundicion") ? 16 : 6, azufre: sabe(t, "alquimia") ? 10 : 0, hierro: sabe(t, "hierro") ? 16 : 0, oro: 4 };
    const enAlmacen: Record<string, string> = { carbon: "carbon", cobre: "mineral_cobre", azufre: "azufre", hierro: "mineral_hierro", oro: "oro" };
    for (const [mineral, objetivo] of Object.entries(quiere)) {
      if (objetivo <= 0 || (t.almacen[enAlmacen[mineral]] ?? 0) >= objetivo) continue;
      pedirNodos(m, t, "minar", mineral, 3, 1.6 + (mineral === "hierro" || mineral === "cobre" ? 0.6 : 0), 320, Math.max(g, MINERALES[mineral].grado === 1 ? 1 : 0));
    }
  }

  // 5b) Puntos de entrega junto a lo que se explota (como en AoE): campamento maderero, minero y molino.
  if (pob >= 4 && basicos) campamentos(m, t);

  // 6) Fuego vivo.
  for (const f of terminadas(m, t, "fogata")) if (f.combustible < (m.estacion === "otoño" || m.estacion === "invierno" ? 1400 : 700) && (t.almacen.madera ?? 0) >= 2 && !yaHay(m, t, "avivar", f.id)) crearTarea(m, t, "cocinar", "avivar", f.id, f.x, f.z, f.combustible <= 0 ? 4 : 2.5);

  // 7) Fabricar (taller, horno, forja).
  if (abiertas(m, t, "fabricar").length < (pob > 10 ? 2 : 1)) {
    const r = pedidoDeFabricacion(m, t, adultos.length);
    if (r) {
      const lugar = terminadas(m, t, r.lugar === "fuego" ? "fogata" : r.lugar)[0];
      if (lugar) crearTarea(m, t, "fabricar", "fabricar", lugar.id, lugar.x, lugar.z, 2.2, { receta: r.id });
    }
  }

  // 8) Investigar (en el círculo de sabios o la biblioteca).
  if (t.investigando) {
    const sitios = [...terminadas(m, t, "universidad"), ...terminadas(m, t, "biblioteca"), ...terminadas(m, t, "templo"), ...terminadas(m, t, "circulo")];
    const max = Math.max(1, Math.ceil(adultos.length / 5));
    if (sitios.length && abiertas(m, t, "investigar").length < max) {
      const s = sitios[0];
      crearTarea(m, t, "investigar", "investigar", s.id, s.x, s.z, 1.8);
    }
  }

  // 9) Curar, vigilar, apagar.
  for (const c of miembros) {
    if ((c.vida < 70 || c.enfermedad || c.derribado) && !yaHay(m, t, "curar", c.id)) crearTarea(m, t, "curar", "curar", c.id, c.x, c.z, c.derribado ? 6 : 3);
  }
  const enGuerra = Object.values(t.relaciones).some((v) => v <= -60);
  const lobosCerca = [...m.animales.values()].some((b) => b.especie === "lobo" && Math.hypot(b.cuerpo.x - t.centro.x, b.cuerpo.y - t.centro.z) < 35);
  if ((m.esNoche || m.ciclo.fase.nombre === "atardecer") && (enGuerra || lobosCerca) && abiertas(m, t, "vigilar").length < (enGuerra ? 2 : 1)) {
    const torre = terminadas(m, t, "torre")[0] ?? estructurasDe(m, t, "fogata")[0];
    const lugar = torre ?? t.centro;
    crearTarea(m, t, "vigilar", "vigilar", torre?.id ?? null, lugar.x, lugar.z, 2.5);
  }
  for (const [k, f] of m.incendios) {
    if (Math.hypot(f.x - t.centro.x, f.z - t.centro.z) < 40 && !yaHay(m, t, "apagar", k) && abiertas(m, t, "apagar").length < 4) crearTarea(m, t, "vigilar", "apagar", k, f.x, f.z, 5);
  }
}

export function sistemaPlanificador(m: Mundo, _dt: number): void {
  if (m.tick % (HZ * 2) === 0) limpiar(m);
  let i = 0;
  for (const t of m.tribus.values()) {
    if (!t.extinta && (m.tick + i * 7) % (HZ * 4) === 0) planificar(m, t);
    i++;
  }
}
