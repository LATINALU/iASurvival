// Árbol de progresión de cada tribu: Era de Piedra → Cobre → Hierro → Pólvora. El conocimiento sale del trabajo
// diario (cada golpe de hacha enseña algo) y de los sabios que investigan junto al fuego o en la biblioteca. El
// consejo elige qué investigar según el carácter de su líder. Y está el caos: las INSPIRACIONES (¡eureka!) de
// colonos brillantes o curiosos completan inventos de golpe o, rara vez, saltan etapas (una tribu de la Edad de
// Piedra que descubre la pólvora…). El comercio y los saqueos también difunden ideas.

import { recordar } from "./animo.ts";
import { tiene, tieneRasgo } from "./colonos.ts";
import { HZ, type Mundo } from "./mundo.ts";
import type { Tribu } from "./tipos.ts";

export interface Tecnologia {
  readonly id: string;
  readonly nombre: string;
  readonly era: 1 | 2 | 3 | 4;
  readonly rama: "vida" | "guerra" | "construccion" | "metal" | "saber";
  readonly descripcion: string;
  readonly requiere: readonly string[];
  readonly costo: number;
  /** Mejora de edificio: hace falta tenerlo terminado para investigarla. */
  readonly edificio?: string;
  /** Multiplicadores que da (talar, minar, recolectar, cultivar, construir, danio_cuerpo, danio_distancia, armadura, saber). */
  readonly efecto?: Readonly<Record<string, number>>;
}

export const ERAS = ["", "Edad de Piedra", "Edad del Cobre", "Edad del Hierro", "Era de la Pólvora"] as const;

/** Mejora de edificio (estilo AoE): se investiga teniendo el edificio y da un efecto concreto. */
const mj = (id: string, nombre: string, era: Tecnologia["era"], edificio: string, costo: number, efecto: Record<string, number>, descripcion: string, requiere: string[] = []): Tecnologia =>
  ({ id, nombre, era, rama: "construccion", costo: costo * ESCALA_ERA_MJ[era] * 10, requiere, descripcion, edificio, efecto });
const ESCALA_ERA_MJ = [0, 2, 3, 4, 6];

export const MEJORAS: readonly Tecnologia[] = [
  mj("hacha_doble", "Hacha de doble filo", 1, "campamento_maderero", 40, { talar: 1.2 }, "Se tala un 20 % más rápido."),
  mj("sierra_arco", "Sierra de arco", 2, "campamento_maderero", 70, { talar: 1.2 }, "Otro 20 % de madera.", ["hacha_doble"]),
  mj("sierra_doble", "Sierra de dos hombres", 3, "campamento_maderero", 90, { talar: 1.15 }, "Los grandes troncos caen solos.", ["sierra_arco"]),
  mj("pico_reforzado", "Pico reforzado", 1, "campamento_minero", 40, { minar: 1.2 }, "Se pica un 20 % más."),
  mj("galerias", "Galerías apuntaladas", 2, "campamento_minero", 70, { minar: 1.2 }, "Minas más hondas y seguras.", ["pico_reforzado"]),
  mj("pozo_minero", "Pozo minero con torno", 3, "campamento_minero", 90, { minar: 1.15 }, "El mineral sube en cubos.", ["galerias"]),
  mj("collera", "Collera", 1, "molino", 40, { cultivar: 1.2 }, "Cosechas un 20 % mayores."),
  mj("arado_pesado", "Arado pesado", 2, "molino", 70, { cultivar: 1.25 }, "La tierra rinde más.", ["collera"]),
  mj("rotacion", "Rotación de cultivos", 3, "molino", 90, { cultivar: 1.2 }, "El campo no se cansa.", ["arado_pesado"]),
  mj("cestas", "Cestas de mimbre", 1, "centro", 35, { recolectar: 1.2 }, "Se recolecta más por viaje."),
  mj("andamios", "Andamios", 2, "centro", 60, { construir: 1.25 }, "Las obras avanzan más rápido."),
  mj("mamposteria", "Mampostería", 3, "universidad", 90, { construir: 1.2 }, "Se construye mejor y más rápido."),
  mj("forja_hojas", "Forja de hojas", 2, "forja", 70, { danio_cuerpo: 1.15 }, "Espadas y lanzas más afiladas."),
  mj("escamas", "Armadura de escamas", 2, "forja", 70, { armadura: 1.15 }, "Placas cosidas al cuero."),
  mj("cota_malla", "Cota de malla", 3, "forja", 100, { armadura: 1.2 }, "Anillos de hierro entrelazados.", ["escamas"]),
  mj("templado", "Templado", 3, "forja", 100, { danio_cuerpo: 1.15 }, "El acero no se mella.", ["forja_hojas"]),
  mj("emplumado", "Flechas emplumadas", 1, "galeria", 45, { danio_distancia: 1.15 }, "Vuelan rectas y lejos."),
  mj("arco_compuesto", "Arco compuesto", 2, "galeria", 75, { danio_distancia: 1.2 }, "Hueso, madera y tendón.", ["emplumado"]),
  mj("punteria", "Escuela de puntería", 3, "galeria", 95, { danio_distancia: 1.15 }, "Cada tiro cuenta.", ["arco_compuesto"]),
  mj("escudos", "Escudos de madera", 1, "cuartel", 45, { armadura: 1.1 }, "Se bloquean los golpes."),
  mj("disciplina", "Disciplina", 2, "cuartel", 75, { danio_cuerpo: 1.1, armadura: 1.05 }, "Se pelea en formación.", ["escudos"]),
  mj("rituales", "Rituales", 2, "templo", 60, { saber: 1.15 }, "Los sabios se inspiran en el templo."),
  mj("imprenta", "Imprenta", 4, "universidad", 120, { saber: 1.3 }, "Los libros se multiplican."),
  mj("quimica", "Química", 4, "universidad", 130, { danio_distancia: 1.2 }, "Pólvora más potente.", ["alquimia"]),
];

/** Multiplicador total de las mejoras conocidas para una clave (1 = sin mejoras). */
export function bono(t: Tribu | undefined, clave: string): number {
  if (!t) return 1;
  let b = 1;
  for (const id of t.conoce) { const x = TEC_POR_ID.get(id); if (x?.efecto?.[clave]) b *= x.efecto[clave]; }
  return b;
}

const ESCALA_ERA = [0, 3, 5, 7, 10];
const t = (id: string, nombre: string, era: Tecnologia["era"], rama: Tecnologia["rama"], costo: number, requiere: string[], descripcion: string): Tecnologia =>
  ({ id, nombre, era, rama, costo: costo * ESCALA_ERA[era] * 10, requiere, descripcion });

export const TECNOLOGIAS: readonly Tecnologia[] = [
  t("fuego", "Fuego", 1, "vida", 0, [], "Fogatas, calor y comida asada."),
  t("piedra", "Herramientas de piedra", 1, "metal", 0, [], "Hachas, picos y lanzas de piedra."),
  t("agricultura", "Agricultura", 1, "vida", 60, [], "Huertos y cosechas."),
  t("carpinteria", "Carpintería", 1, "construccion", 80, [], "Cabañas de troncos, empalizadas y talleres."),
  t("caza", "Caza organizada", 1, "guerra", 50, [], "Cazar en grupo; armaduras de cuero."),
  t("arco", "Arco y flechas", 1, "guerra", 130, ["caza"], "Arcos: atacar y cazar a distancia."),
  t("alfareria", "Alfarería", 1, "vida", 70, ["agricultura"], "Graneros: la comida dura más."),
  t("hierbas", "Saber de hierbas", 1, "vida", 70, [], "Vendas y remedios."),
  t("canteria", "Cantería", 1, "construccion", 150, ["carpinteria"], "Casas y murallas de piedra, torres."),
  t("mineria", "Minería", 1, "metal", 130, ["canteria"], "Extraer cobre, carbón y azufre."),
  t("fundicion", "Fundición", 2, "metal", 220, ["mineria"], "Hornos: fundir cobre en lingotes."),
  t("herreria", "Herrería", 2, "metal", 240, ["fundicion"], "Forja: herramientas, espadas y armaduras de cobre."),
  t("rueda", "La rueda", 2, "construccion", 190, ["carpinteria"], "Caminos: se viaja más rápido."),
  t("escritura", "Escritura", 2, "saber", 260, ["alfareria"], "Bibliotecas: se investiga el doble."),
  t("arquitectura", "Arquitectura", 2, "construccion", 280, ["canteria", "escritura"], "Casas grandes de dos pisos y plaza."),
  t("hierro", "Hierro", 3, "metal", 380, ["herreria"], "Fundir hierro: herramientas y espadas de hierro."),
  t("armaduras", "Armaduras", 3, "guerra", 320, ["herreria"], "Corazas de cobre y de hierro."),
  t("fortificacion", "Fortificación", 3, "construccion", 340, ["arquitectura"], "Murallas de piedra con puertas y torres."),
  t("medicina", "Medicina", 3, "saber", 320, ["hierbas", "escritura"], "Enfermerías: las heridas sanan el doble."),
  t("alquimia", "Alquimia", 4, "saber", 480, ["hierro", "escritura"], "Pólvora a partir de azufre y carbón."),
  t("arcabuz", "Arcabuz", 4, "guerra", 560, ["alquimia"], "Armas de fuego: casi nadie puede resistirlas."),
];

export const TEC_POR_ID: ReadonlyMap<string, Tecnologia> = new Map([...TECNOLOGIAS, ...MEJORAS].map((x) => [x.id, x]));
export const INICIALES = ["fuego", "piedra"];

/** Estado tecnológico guardado en la tribu (en `stats` y en `conoce`). */
export function sabe(t: Tribu, id: string): boolean {
  return t.conoce.includes(id);
}

/** Edad de la civilización (se sube como en AoE: conocimientos + edificios + recursos). */
export function era(t: Tribu): number {
  return t.edad ?? 1;
}

/** Qué puede investigar: inventos de su edad (o anteriores) y mejoras de los edificios que tiene. */
export function disponibles(t: Tribu, m?: Mundo): Tecnologia[] {
  return [...TECNOLOGIAS, ...MEJORAS].filter((x) => !sabe(t, x.id) && x.era <= era(t) && x.requiere.every((r) => sabe(t, r))
    && (!x.edificio || !m || [...m.estructuras.values()].some((e) => e.tribu === t.id && e.tipo === x.edificio && e.progreso >= 1)));
}

/** Edificios que cuentan para subir de edad (hay que tener 2 distintos de la edad actual). */
export const EDIFICIOS_EDAD: Readonly<Record<number, readonly string[]>> = {
  1: ["centro", "molino", "campamento_maderero", "campamento_minero", "taller", "granero", "circulo"],
  2: ["mercado", "templo", "forja", "cuartel", "galeria", "biblioteca", "horno"],
  3: ["universidad", "castillo", "enfermeria", "casa_grande"],
};
/** Inventos de la edad actual que hay que conocer y recursos para pasar a la siguiente. */
export const REQUISITO_EDAD: Readonly<Record<number, { readonly inventos: number; readonly costo: Readonly<Record<string, number>> }>> = {
  1: { inventos: 5, costo: { comida: 250, madera: 150 } },
  2: { inventos: 4, costo: { comida: 450, piedra: 200, oro: 8 } },
  3: { inventos: 4, costo: { comida: 800, piedra: 350, oro: 25 } },
};

const esComida = (o: string): boolean => /^(bayas|verdura|carne|guiso|pan|pescado)/.test(o);

/** Intenta empezar (o terminar) el paso a la siguiente edad. */
function avanzarEdad(m: Mundo, t: Tribu): void {
  const e = era(t);
  const hasta = t.stats.avanceEdad;
  if (hasta !== undefined) {
    if (m.tick < hasta) return;
    delete t.stats.avanceEdad;
    t.edad = e + 1;
    m.emitir("era", `¡${t.nombre} entra en la ${ERAS[t.edad]}!`, { x: t.centro.x, z: t.centro.z, interes: 3, tribu: t.id, datos: { era: t.edad } });
    for (const c of m.miembros(t.id)) recordar(m, c, "obra_terminada", 8, `Entramos en la ${ERAS[t.edad]}`, 2);
    return;
  }
  const req = REQUISITO_EDAD[e];
  if (!req) return;
  const inventos = t.conoce.filter((id) => TEC_POR_ID.get(id)?.era === e && !TEC_POR_ID.get(id)?.edificio).length;
  if (inventos < req.inventos) return;
  const tipos = new Set([...m.estructuras.values()].filter((x) => x.tribu === t.id && x.progreso >= 1 && EDIFICIOS_EDAD[e].includes(x.tipo)).map((x) => x.tipo));
  if (tipos.size < 2) return;
  const comida = Object.entries(t.almacen).filter(([o]) => esComida(o)).reduce((s, [, n]) => s + n, 0);
  for (const [o, n] of Object.entries(req.costo)) if ((o === "comida" ? comida : t.almacen[o] ?? 0) < n) return;
  // Paga y empieza el avance (un día).
  for (const [o, n] of Object.entries(req.costo)) {
    if (o !== "comida") { m.sacar(t, o, n); continue; }
    let falta = n;
    for (const [c] of Object.entries(t.almacen).filter(([x]) => esComida(x))) { if (falta <= 0) break; falta -= m.sacar(t, c, falta); }
  }
  t.stats.avanceEdad = m.tick + m.ticksDia;
  m.emitir("avance", `${t.nombre} empieza a entrar en la ${ERAS[e + 1]}.`, { x: t.centro.x, z: t.centro.z, interes: 2, tribu: t.id });
}

/** Aprende una tecnología (con anuncio). */
export function aprender(m: Mundo, t: Tribu, id: string, como: string, quien?: string): void {
  if (sabe(t, id)) return;
  const tec = TEC_POR_ID.get(id)!;
  const eraAntes = era(t);
  t.conoce.push(id);
  if (t.investigando === id) { t.investigando = null; t.conocimiento = 0; }
  const salto = tec.requiere.some((r) => !sabe(t, r) && r !== id);
  m.emitir("invento", `${t.nombre} ${como} ${tec.nombre.toLowerCase()}${salto ? " ¡saltándose etapas!" : ""}.`, { x: t.centro.x, z: t.centro.z, actores: quien ? [quien] : [], interes: tec.era >= 3 || salto ? 3 : 2, tribu: t.id, datos: { tec: id } });
  void eraAntes;
}

/** Suma conocimiento a la investigación actual de la tribu. */
export function aportar(m: Mundo, t: Tribu, puntos: number): void {
  if (!t.investigando) elegirInvestigacion(m, t);
  if (!t.investigando) return;
  t.conocimiento += puntos * (sabe(t, "escritura") ? 1.5 : 1) * bono(t, "saber");
  const tec = TEC_POR_ID.get(t.investigando)!;
  if (t.conocimiento >= tec.costo) aprender(m, t, tec.id, "descubre");
}

/** El consejo elige qué investigar según el carácter de su líder. */
export function elegirInvestigacion(m: Mundo, t: Tribu): void {
  const opciones = disponibles(t, m);
  if (!opciones.length) return;
  const lider = t.lider ? m.colonos.get(t.lider) : undefined;
  const peso = (x: Tecnologia): number => {
    let p = 100 / x.costo;
    if (lider) {
      if (x.rama === "guerra" && (tiene(lider, "belicoso") || tiene(lider, "sanguinario"))) p *= 2.5;
      if (x.rama === "construccion" && tiene(lider, "visionario")) p *= 2.2;
      if (x.rama === "saber" && (tieneRasgo(lider, "brillante") || tieneRasgo(lider, "filosofo"))) p *= 2;
      if (x.rama === "vida" && lider.personalidad.empatico > 0.3) p *= 1.6;
      if (x.rama === "metal" && tieneRasgo(lider, "manitas")) p *= 1.8;
    }
    const guerra = Object.values(t.relaciones).some((v) => v <= -60);
    if (guerra && x.rama === "guerra") p *= 2;
    return p;
  };
  const total = opciones.reduce((s, x) => s + peso(x), 0);
  let r = m.azar.siguiente() * total;
  for (const x of opciones) {
    r -= peso(x);
    if (r <= 0) { t.investigando = x.id; t.conocimiento = 0; return; }
  }
}

/** Sistema: inspiraciones (eurekas) cada ~1/10 de día. */
export function sistemaTecnologia(m: Mundo, _dt: number): void {
  const cada = Math.round(m.ticksDia / 10);
  if (m.tick % cada !== 11) return;
  for (const t of m.tribus.values()) {
    if (t.extinta) continue;
    avanzarEdad(m, t);
    const miembros = m.miembros(t.id).filter((c) => !m.esNino(c));
    if (!t.investigando) elegirInvestigacion(m, t);
    for (const c of miembros) {
      let p = 0.0006;
      if (tieneRasgo(c, "brillante")) p *= 3;
      if (tieneRasgo(c, "curioso") || tieneRasgo(c, "sonador") || tieneRasgo(c, "filosofo")) p *= 2;
      if (c.inspiracion) p *= 4;
      if (!m.azar.prob(p)) continue;
      // ¡Eureka! Completa la investigación actual o, rara vez, salta a algo para lo que no estaban preparados.
      const saltos = TECNOLOGIAS.filter((x) => !sabe(t, x.id) && x.requiere.filter((r) => !sabe(t, r)).length === 1 && x.requiere.length > 0 && x.era <= era(t) + 1);
      let id = t.investigando;
      let como = "logra";
      if (saltos.length && m.azar.prob(0.12)) {
        id = saltos[Math.floor(m.azar.siguiente() * saltos.length)].id;
        como = "por una inspiración de " + c.nombre + ", descubre";
      } else if (id) {
        como = "gracias a " + c.nombre + ", descubre";
      }
      if (!id) continue;
      aprender(m, t, id, como, c.id);
      c.inspiracion = { hasta: m.tick + Math.round(m.ticksDia * 0.3) };
      recordar(m, c, "obra_terminada", 10, "¡Tuve una idea genial!", 2);
      break;
    }
  }
}

/** Ideas que viajan: comerciar o saquear puede enseñar algo que el otro sabe. */
export function contagiarIdea(m: Mundo, de: Tribu, a: Tribu, prob: number): void {
  const nuevas = de.conoce.filter((id) => !sabe(a, id) && TEC_POR_ID.get(id)!.requiere.every((r) => sabe(a, r)));
  if (!nuevas.length || !m.azar.prob(prob)) return;
  aprender(m, a, nuevas[Math.floor(m.azar.siguiente() * nuevas.length)], `aprende de ${de.nombre}`);
}

export const _HZ = HZ;
