// Catálogo de las colonias: objetos (con su era), recetas (fuego, taller, horno, forja), construcciones con su
// costo y la tecnología que piden, nodos de recursos y fauna. Son DATOS: el consejo de cada tribu decide qué
// construir y fabricar leyendo esto y su árbol tecnológico.

import type { supervivencia } from "txnucleo";

export interface DefObjeto {
  readonly id: string;
  readonly nombre: string;
  /** Comida: cuánto llena (y si es cruda). */
  readonly comida?: { readonly hambre: number; readonly cruda?: boolean; readonly carne?: boolean };
  /** Arma: daño, alcance (≥ 4 = a distancia) y segundos entre golpes. */
  readonly arma?: { readonly danio: number; readonly alcance: number; readonly cadencia?: number };
  /** Herramienta: para qué trabajo, cuánto rinde y qué grado de veta puede picar. */
  readonly herramienta?: { readonly para: string; readonly bono: number; readonly grado: number };
  readonly ropa?: { readonly abrigo: number };
  /** Armadura: divide el daño recibido. */
  readonly armadura?: number;
  readonly cura?: number;
}

const o = (id: string, nombre: string, extra: Omit<DefObjeto, "id" | "nombre"> = {}): [string, DefObjeto] => [id, { id, nombre, ...extra }];

export const OBJETOS: ReadonlyMap<string, DefObjeto> = new Map<string, DefObjeto>([
  o("madera", "madera"), o("piedra", "piedra"), o("fibra", "fibra"), o("piel", "piel"),
  o("hierbas", "hierbas medicinales", { cura: 15 }),
  o("carbon", "carbón"), o("mineral_cobre", "mineral de cobre"), o("mineral_hierro", "mineral de hierro"), o("oro", "oro"), o("azufre", "azufre"),
  o("lingote_cobre", "lingote de cobre"), o("lingote_hierro", "lingote de hierro"), o("polvora", "pólvora"),
  o("bayas", "bayas", { comida: { hambre: 9 } }),
  o("verdura", "verdura", { comida: { hambre: 14 } }),
  o("carne_cruda", "carne cruda", { comida: { hambre: 12, cruda: true, carne: true } }),
  o("carne_asada", "carne asada", { comida: { hambre: 32, carne: true } }),
  o("guiso", "guiso", { comida: { hambre: 45, carne: true } }),
  o("pan_raices", "torta de raíces", { comida: { hambre: 30 } }),
  // Armas por era.
  o("lanza", "lanza de piedra", { arma: { danio: 14, alcance: 2.4 } }),
  o("arco", "arco", { arma: { danio: 12, alcance: 12, cadencia: 1.7 } }),
  o("espada_cobre", "espada de cobre", { arma: { danio: 22, alcance: 1.8 } }),
  o("espada_hierro", "espada de hierro", { arma: { danio: 32, alcance: 1.9 } }),
  o("arcabuz", "arcabuz", { arma: { danio: 60, alcance: 15, cadencia: 3.2 } }),
  // Herramientas por era (grado de veta).
  o("hacha", "hacha de piedra", { arma: { danio: 10, alcance: 1.6 }, herramienta: { para: "talar", bono: 2, grado: 1 } }),
  o("pico", "pico de piedra", { herramienta: { para: "minar", bono: 2, grado: 1 } }),
  o("hacha_cobre", "hacha de cobre", { arma: { danio: 16, alcance: 1.6 }, herramienta: { para: "talar", bono: 3, grado: 2 } }),
  o("pico_cobre", "pico de cobre", { herramienta: { para: "minar", bono: 3, grado: 2 } }),
  o("hacha_hierro", "hacha de hierro", { arma: { danio: 22, alcance: 1.6 }, herramienta: { para: "talar", bono: 4, grado: 3 } }),
  o("pico_hierro", "pico de hierro", { herramienta: { para: "minar", bono: 4, grado: 3 } }),
  // Ropa y armaduras.
  o("abrigo", "abrigo de piel", { ropa: { abrigo: 0.55 } }),
  o("manta", "manta de fibra", { ropa: { abrigo: 0.35 } }),
  o("armadura_cuero", "armadura de cuero", { armadura: 1.35 }),
  o("armadura_cobre", "coraza de cobre", { armadura: 1.8 }),
  o("armadura_hierro", "coraza de hierro", { armadura: 2.5 }),
  o("vendas", "vendas", { cura: 30 }),
]);

export const COMIDAS = [...OBJETOS.values()].filter((x) => x.comida).map((x) => x.id);
export const ARMAS = [...OBJETOS.values()].filter((x) => x.arma && !x.herramienta).map((x) => x.id);
export const ARMADURAS = [...OBJETOS.values()].filter((x) => x.armadura).map((x) => x.id);

/** Recetas: dónde se hacen, qué tecnología piden y qué dan. */
export interface DefReceta {
  readonly id: string;
  readonly lugar: "fuego" | "taller" | "horno" | "forja";
  readonly ingredientes: Readonly<Record<string, number>>;
  readonly da: Readonly<Record<string, number>>;
  readonly segundos: number;
  readonly tec?: string;
}

export const RECETAS: readonly DefReceta[] = [
  { id: "carne_asada", lugar: "fuego", ingredientes: { carne_cruda: 1 }, da: { carne_asada: 1 }, segundos: 5 },
  { id: "guiso", lugar: "fuego", ingredientes: { carne_cruda: 1, verdura: 2 }, da: { guiso: 2 }, segundos: 9, tec: "agricultura" },
  { id: "pan_raices", lugar: "fuego", ingredientes: { verdura: 2, bayas: 2 }, da: { pan_raices: 2 }, segundos: 8, tec: "agricultura" },
  { id: "lanza", lugar: "taller", ingredientes: { madera: 4, piedra: 2, fibra: 2 }, da: { lanza: 1 }, segundos: 14 },
  { id: "hacha", lugar: "taller", ingredientes: { madera: 3, piedra: 3, fibra: 1 }, da: { hacha: 1 }, segundos: 12 },
  { id: "pico", lugar: "taller", ingredientes: { madera: 3, piedra: 3, fibra: 1 }, da: { pico: 1 }, segundos: 12 },
  { id: "arco", lugar: "taller", ingredientes: { madera: 5, fibra: 5 }, da: { arco: 1 }, segundos: 16, tec: "arco" },
  { id: "abrigo", lugar: "taller", ingredientes: { piel: 4, fibra: 3 }, da: { abrigo: 1 }, segundos: 18 },
  { id: "manta", lugar: "fuego", ingredientes: { fibra: 6 }, da: { manta: 1 }, segundos: 10 },
  { id: "armadura_cuero", lugar: "taller", ingredientes: { piel: 5, fibra: 3 }, da: { armadura_cuero: 1 }, segundos: 20, tec: "caza" },
  { id: "vendas", lugar: "taller", ingredientes: { fibra: 3, hierbas: 1 }, da: { vendas: 3 }, segundos: 8, tec: "hierbas" },
  { id: "lingote_cobre", lugar: "horno", ingredientes: { mineral_cobre: 2, carbon: 1 }, da: { lingote_cobre: 1 }, segundos: 12, tec: "fundicion" },
  { id: "lingote_hierro", lugar: "horno", ingredientes: { mineral_hierro: 2, carbon: 2 }, da: { lingote_hierro: 1 }, segundos: 16, tec: "hierro" },
  { id: "polvora", lugar: "horno", ingredientes: { azufre: 1, carbon: 2 }, da: { polvora: 2 }, segundos: 14, tec: "alquimia" },
  { id: "espada_cobre", lugar: "forja", ingredientes: { lingote_cobre: 2, madera: 1 }, da: { espada_cobre: 1 }, segundos: 18, tec: "herreria" },
  { id: "hacha_cobre", lugar: "forja", ingredientes: { lingote_cobre: 2, madera: 2 }, da: { hacha_cobre: 1 }, segundos: 15, tec: "herreria" },
  { id: "pico_cobre", lugar: "forja", ingredientes: { lingote_cobre: 2, madera: 2 }, da: { pico_cobre: 1 }, segundos: 15, tec: "herreria" },
  { id: "armadura_cobre", lugar: "forja", ingredientes: { lingote_cobre: 4, piel: 2 }, da: { armadura_cobre: 1 }, segundos: 24, tec: "armaduras" },
  { id: "espada_hierro", lugar: "forja", ingredientes: { lingote_hierro: 2, madera: 1 }, da: { espada_hierro: 1 }, segundos: 20, tec: "hierro" },
  { id: "hacha_hierro", lugar: "forja", ingredientes: { lingote_hierro: 2, madera: 2 }, da: { hacha_hierro: 1 }, segundos: 16, tec: "hierro" },
  { id: "pico_hierro", lugar: "forja", ingredientes: { lingote_hierro: 2, madera: 2 }, da: { pico_hierro: 1 }, segundos: 16, tec: "hierro" },
  { id: "armadura_hierro", lugar: "forja", ingredientes: { lingote_hierro: 4, piel: 2 }, da: { armadura_hierro: 1 }, segundos: 28, tec: "armaduras" },
  { id: "arcabuz", lugar: "forja", ingredientes: { lingote_hierro: 3, madera: 2, polvora: 2 }, da: { arcabuz: 1 }, segundos: 30, tec: "arcabuz" },
];
export const RECETA_POR_ID: ReadonlyMap<string, DefReceta> = new Map(RECETAS.map((r) => [r.id, r]));

// ------------------------------------------------------------ construcciones

export interface DefEstructura {
  readonly id: string;
  readonly nombre: string;
  readonly costo: Readonly<Record<string, number>>;
  /** Segundos de trabajo de una persona con habilidad media. */
  readonly trabajo: number;
  /** Radio que ocupa (para colocar sin solaparse). */
  readonly radio: number;
  readonly camas?: number;
  readonly aislamiento?: number;
  /** Los lobos no atacan dentro. */
  readonly refugio?: boolean;
  readonly fuego?: { readonly inicial: number; readonly porMadera: number; readonly max: number };
  readonly vida: number;
  readonly arde: boolean;
  /** Tecnología que hace falta. */
  readonly tec?: string;
  /** Muro: bloquea el paso (las puertas dejan pasar a la propia gente). */
  readonly muro?: "muro" | "puerta";
  /** Lugar de trabajo para recetas. */
  readonly lugar?: DefReceta["lugar"];
  /** Investigación: multiplica el conocimiento de quien estudia aquí. */
  readonly saber?: number;
  /** Mejora la curación de quien duerme aquí. */
  readonly cura?: number;
  /** Punto de entrega: qué recibe ("todo", "comida" o una lista de objetos). */
  readonly entrega?: "todo" | "comida" | readonly string[];
  /** Cuenta para el tope de población (camas de vivienda). Las enfermerías no. */
  readonly vivienda?: boolean;
  /** Edad mínima de la civilización para construirlo. */
  readonly edad?: number;
}

const e = (id: string, nombre: string, costo: Record<string, number>, trabajo: number, radio: number, vida: number, arde: boolean, extra: Partial<DefEstructura> = {}): [string, DefEstructura] =>
  [id, { id, nombre, costo, trabajo, radio, vida, arde, ...extra }];

export const ESTRUCTURAS: ReadonlyMap<string, DefEstructura> = new Map<string, DefEstructura>([
  e("fogata", "fogata", { madera: 5, piedra: 4 }, 8, 1.5, 60, false, { fuego: { inicial: 600, porMadera: 240, max: 2400 }, lugar: "fuego" }),
  e("pozo", "pozo", { piedra: 10, madera: 4 }, 12, 1.3, 150, false),
  e("almacen", "almacén", { madera: 14 }, 14, 2.2, 80, true, { entrega: "todo" }),
  e("centro", "centro urbano", { madera: 45, piedra: 25 }, 110, 3.6, 700, false, { camas: 6, aislamiento: 0.85, refugio: true, entrega: "todo", vivienda: true }),
  e("campamento_maderero", "campamento maderero", { madera: 18 }, 16, 2.2, 120, true, { entrega: ["madera"] }),
  e("campamento_minero", "campamento minero", { madera: 22 }, 18, 2.2, 140, true, { entrega: ["piedra", "carbon", "mineral_cobre", "mineral_hierro", "oro", "azufre"] }),
  e("molino", "molino", { madera: 30, piedra: 8 }, 30, 2.4, 150, true, { entrega: "comida", tec: "agricultura" }),
  e("circulo", "círculo de sabios", { madera: 8, piedra: 6 }, 12, 2.0, 60, false, { saber: 1 }),
  e("choza", "choza", { madera: 22, fibra: 8 }, 30, 2.2, 100, true, { camas: 3, aislamiento: 0.55, vivienda: true }),
  e("cabana", "cabaña de troncos", { madera: 36 }, 45, 2.6, 160, true, { camas: 4, aislamiento: 0.7, refugio: true, tec: "carpinteria", vivienda: true }),
  e("casa", "casa de piedra", { madera: 20, piedra: 34 }, 70, 3, 260, false, { camas: 5, aislamiento: 0.85, refugio: true, tec: "canteria", vivienda: true }),
  e("casa_grande", "casa grande", { madera: 30, piedra: 50 }, 110, 3.6, 380, false, { camas: 9, aislamiento: 0.9, refugio: true, tec: "arquitectura", vivienda: true }),
  e("huerto", "huerto", { madera: 4, fibra: 2 }, 8, 2, 40, true, { tec: "agricultura" }),
  e("granero", "granero", { madera: 24, piedra: 6 }, 26, 2.4, 120, true, { tec: "alfareria", entrega: "comida" }),
  e("cocina", "horno de pan", { piedra: 14, madera: 4 }, 16, 1.6, 120, false, { fuego: { inicial: 99999, porMadera: 0, max: 99999 }, lugar: "fuego", tec: "alfareria" }),
  e("taller", "taller", { madera: 18, piedra: 8 }, 22, 2.2, 100, true, { lugar: "taller" }),
  e("horno", "horno de fundición", { piedra: 24, madera: 6 }, 30, 1.8, 200, false, { lugar: "horno", tec: "fundicion" }),
  e("forja", "forja", { piedra: 16, madera: 10, lingote_cobre: 2 }, 34, 2.2, 200, false, { lugar: "forja", tec: "herreria" }),
  e("biblioteca", "biblioteca", { madera: 30, piedra: 30 }, 60, 2.8, 200, true, { saber: 2.5, tec: "escritura" }),
  e("enfermeria", "enfermería", { madera: 26, piedra: 20, fibra: 10 }, 50, 2.6, 180, false, { camas: 3, aislamiento: 0.8, refugio: true, cura: 2, tec: "medicina" }),
  e("totem", "tótem", { madera: 10, piedra: 6 }, 16, 1.2, 80, true),
  e("torre", "torre de vigía", { madera: 20, piedra: 10 }, 24, 1.6, 160, true, { tec: "carpinteria" }),
  e("empalizada", "empalizada", { madera: 4 }, 5, 1.0, 90, true, { muro: "muro", tec: "carpinteria" }),
  e("portal", "portón de madera", { madera: 8 }, 8, 1.4, 120, true, { muro: "puerta", tec: "carpinteria" }),
  e("cuartel", "cuartel", { madera: 60, piedra: 10 }, 60, 3.0, 300, true, { edad: 2 }),
  e("galeria", "galería de tiro", { madera: 60, fibra: 10 }, 55, 3.0, 260, true, { edad: 2, tec: "arco" }),
  e("mercado", "mercado", { madera: 70, piedra: 20 }, 65, 3.2, 280, true, { edad: 2 }),
  e("templo", "templo", { piedra: 90, madera: 20 }, 90, 3.0, 500, false, { edad: 2, saber: 1.2 }),
  e("universidad", "universidad", { piedra: 120, madera: 50 }, 120, 3.4, 600, false, { edad: 3, saber: 3, tec: "escritura" }),
  e("castillo", "castillo", { piedra: 300, madera: 60 }, 260, 4.4, 2200, false, { edad: 3, refugio: true, aislamiento: 0.9, tec: "fortificacion" }),
  e("maravilla", "maravilla", { piedra: 600, madera: 200, oro: 60 }, 520, 5.2, 4000, false, { edad: 4 }),
  e("muralla", "muralla de piedra", { piedra: 8 }, 9, 1.0, 400, false, { muro: "muro", tec: "fortificacion" }),
  e("puerta", "puerta fortificada", { piedra: 10, madera: 6 }, 14, 1.4, 500, false, { muro: "puerta", tec: "fortificacion" }),
]);

/** Construcciones que el consejo va levantando (en orden), según población, días y tecnología. */
export const PLAN_ASENTAMIENTO: ReadonlyArray<{ readonly tipo: string; readonly cuantos: (poblacion: number) => number; readonly desde: number }> = [
  { tipo: "fogata", cuantos: () => 1, desde: 0 },
  { tipo: "pozo", cuantos: (p) => (p > 9 ? 2 : 1), desde: 0 },
  { tipo: "almacen", cuantos: (p) => (p > 14 ? 2 : 1), desde: 0 },
  { tipo: "centro", cuantos: () => 1, desde: 0.35 },
  { tipo: "choza", cuantos: (p) => Math.ceil(p / 2), desde: 0 },
  { tipo: "circulo", cuantos: () => 1, desde: 0.2 },
  { tipo: "huerto", cuantos: (p) => Math.max(1, Math.ceil(p / 3)), desde: 0.3 },
  { tipo: "molino", cuantos: () => 1, desde: 0.7 },
  { tipo: "taller", cuantos: () => 1, desde: 0.5 },
  { tipo: "cocina", cuantos: () => 1, desde: 0.8 },
  { tipo: "granero", cuantos: () => 1, desde: 1 },
  { tipo: "totem", cuantos: () => 1, desde: 1.2 },
  { tipo: "torre", cuantos: (p) => (p > 12 ? 2 : 1), desde: 1.5 },
  { tipo: "cuartel", cuantos: (p) => (p > 10 ? 1 : 0), desde: 1 },
  { tipo: "templo", cuantos: (p) => (p > 10 ? 1 : 0), desde: 1 },
  { tipo: "mercado", cuantos: (p) => (p > 12 ? 1 : 0), desde: 1 },
  { tipo: "galeria", cuantos: (p) => (p > 14 ? 1 : 0), desde: 1 },
  { tipo: "universidad", cuantos: () => 1, desde: 1 },
  { tipo: "castillo", cuantos: (p) => (p > 24 ? 1 : 0), desde: 2 },
  { tipo: "maravilla", cuantos: (p) => (p > 35 ? 1 : 0), desde: 3 },
  { tipo: "horno", cuantos: () => 1, desde: 0 },
  { tipo: "forja", cuantos: () => 1, desde: 0 },
  { tipo: "biblioteca", cuantos: () => 1, desde: 0 },
  { tipo: "enfermeria", cuantos: () => 1, desde: 0 },
];

/** ¿Este punto de entrega recibe este objeto? */
export function recibe(def: DefEstructura, objeto: string): boolean {
  if (!def.entrega) return false;
  if (def.entrega === "todo") return true;
  if (def.entrega === "comida") return !!OBJETOS.get(objeto)?.comida;
  return def.entrega.includes(objeto);
}

/** Viviendas por era: el consejo construye la mejor que conoce (y reemplaza chozas viejas con el tiempo). */
export const VIVIENDAS = ["casa_grande", "casa", "cabana", "choza"] as const;

// ------------------------------------------------------------ nodos

export interface DefNodoMundo {
  readonly def: supervivencia.DefNodo;
  readonly extra?: ReadonlyArray<readonly [objeto: string, prob: number]>;
  readonly segundosPorGolpe: number;
  readonly trabajo: string;
  readonly arde: boolean;
}

export const NODOS: ReadonlyMap<string, DefNodoMundo> = new Map<string, DefNodoMundo>([
  ["arbol", { def: { id: "arbol", recurso: "madera", porGolpe: [2, 3], golpes: 6, herramienta: 0, reaparicion: 2400 }, segundosPorGolpe: 3, trabajo: "talar", arde: true }],
  ["roca", { def: { id: "roca", recurso: "piedra", porGolpe: [2, 3], golpes: 900, herramienta: 0, reaparicion: 8000 }, segundosPorGolpe: 3.5, trabajo: "minar", arde: false }],
  ["arbusto", { def: { id: "arbusto", recurso: "bayas", porGolpe: [2, 4], golpes: 4, herramienta: 0, reaparicion: 1500 }, extra: [["fibra", 0.9]], segundosPorGolpe: 2.2, trabajo: "recolectar", arde: true }],
  ["hierbas", { def: { id: "hierbas", recurso: "fibra", porGolpe: [2, 3], golpes: 3, herramienta: 0, reaparicion: 1200 }, extra: [["hierbas", 0.35]], segundosPorGolpe: 2, trabajo: "recolectar", arde: true }],
  ["carbon", { def: { id: "carbon", recurso: "carbon", porGolpe: [2, 3], golpes: 500, herramienta: 1, reaparicion: 11000 }, segundosPorGolpe: 4, trabajo: "minar", arde: false }],
  ["cobre", { def: { id: "cobre", recurso: "mineral_cobre", porGolpe: [1, 2], golpes: 450, herramienta: 1, reaparicion: 12000 }, extra: [["piedra", 0.5]], segundosPorGolpe: 4, trabajo: "minar", arde: false }],
  ["hierro", { def: { id: "hierro", recurso: "mineral_hierro", porGolpe: [1, 2], golpes: 450, herramienta: 2, reaparicion: 13000 }, extra: [["piedra", 0.5]], segundosPorGolpe: 4.5, trabajo: "minar", arde: false }],
  ["oro", { def: { id: "oro", recurso: "oro", porGolpe: [1, 1], golpes: 160, herramienta: 2, reaparicion: 20000 }, segundosPorGolpe: 5, trabajo: "minar", arde: false }],
  ["azufre", { def: { id: "azufre", recurso: "azufre", porGolpe: [1, 2], golpes: 350, herramienta: 1, reaparicion: 14000 }, segundosPorGolpe: 4, trabajo: "minar", arde: false }],
]);

/** Yacimientos: minas y canteras grandes (reemplazan a las piedras y vetas sueltas). NUNCA desaparecen: al vaciar la
 *  reserva de superficie la mina queda en reposo un tiempo (la veta se profundiza) y vuelve a producir; las partidas
 *  duran siglos.
 *  `radio` = lo que ocupa (sólido); `plazas` = cuántos pueden picar a la vez; `cada` = un yacimiento cada N m². */
export const YACIMIENTOS: Readonly<Record<string, { readonly radio: number; readonly plazas: number; readonly cada: number }>> = {
  roca: { radio: 2.6, plazas: 5, cada: 115 * 115 },
  carbon: { radio: 2.2, plazas: 4, cada: 220 * 220 },
  cobre: { radio: 2.2, plazas: 4, cada: 220 * 220 },
  hierro: { radio: 2.2, plazas: 4, cada: 230 * 230 },
  oro: { radio: 1.8, plazas: 3, cada: 340 * 340 },
  azufre: { radio: 2.0, plazas: 3, cada: 290 * 290 },
};
export const esYacimiento = (tipo: string): boolean => tipo in YACIMIENTOS;

export const VARIANTES_ARBOL: Record<string, readonly string[]> = {
  pradera: ["roble", "abedul", "roble"],
  bosque: ["pino", "roble", "abedul", "pino"],
  denso: ["pino", "roble", "abeto"],
  roca: ["abeto", "pino"],
  pantano: ["sauce", "sauce", "abedul"],
  taiga: ["abeto", "abeto", "pino"],
  nieve: ["nevado", "nevado", "abeto"],
  sabana: ["acacia", "acacia", "roble"],
  desierto: ["cactus", "cactus"],
  selva: ["palmera", "jungla", "jungla", "palmera"],
  arena: ["palmera"],
};

/** Vetas de mineral: dónde aparecen y qué grado de pico piden (1 piedra, 2 cobre, 3 hierro). */
export const MINERALES: Readonly<Record<string, { readonly biomas: readonly string[]; readonly prob: number; readonly grado: number }>> = {
  carbon: { biomas: ["roca", "taiga", "bosque"], prob: 0.012, grado: 1 },
  cobre: { biomas: ["roca", "sabana", "pradera"], prob: 0.01, grado: 1 },
  hierro: { biomas: ["roca", "nieve", "taiga"], prob: 0.011, grado: 2 },
  oro: { biomas: ["roca", "desierto"], prob: 0.0025, grado: 2 },
  azufre: { biomas: ["desierto", "roca", "pantano"], prob: 0.004, grado: 1 },
};

// ------------------------------------------------------------ fauna

export interface DefEspecie {
  readonly id: string;
  readonly vida: number;
  readonly velocidad: number;
  readonly velocidadHuida: number;
  readonly danio: number;
  readonly cadencia: number;
  readonly vision: number;
  readonly botin: Readonly<Record<string, number>>;
  /** "presa" huye; "defensivo" ataca solo si lo atacan o lo acorralan; "depredador" caza. */
  readonly conducta: "presa" | "defensivo" | "depredador";
}

export const ESPECIES: ReadonlyMap<string, DefEspecie> = new Map<string, DefEspecie>([
  ["conejo", { id: "conejo", vida: 8, velocidad: 1.2, velocidadHuida: 4.5, danio: 0, cadencia: 0, vision: 7, botin: { carne_cruda: 1, piel: 1 }, conducta: "presa" }],
  ["ciervo", { id: "ciervo", vida: 35, velocidad: 1.1, velocidadHuida: 5.5, danio: 0, cadencia: 0, vision: 13, botin: { carne_cruda: 4, piel: 2 }, conducta: "presa" }],
  ["jabali", { id: "jabali", vida: 45, velocidad: 1.0, velocidadHuida: 4.2, danio: 7, cadencia: 1.8, vision: 8, botin: { carne_cruda: 4, piel: 1 }, conducta: "defensivo" }],
  ["lobo", { id: "lobo", vida: 32, velocidad: 1.6, velocidadHuida: 4.6, danio: 5, cadencia: 2.0, vision: 16, botin: { carne_cruda: 2, piel: 2 }, conducta: "depredador" }],
  ["oso", { id: "oso", vida: 130, velocidad: 1.1, velocidadHuida: 4.0, danio: 15, cadencia: 2.4, vision: 10, botin: { carne_cruda: 8, piel: 4 }, conducta: "defensivo" }],
]);
