// Entidades del mundo de colonias: tribus, colonos, animales, construcciones, nodos de recursos, cuerpos,
// tareas del tablero de cada tribu, incendios y clima. Estado plano (fácil de guardar y de mandar al visor), salvo
// las piezas de TxNucleo que traen sus reglas (Necesidades, NodoRecoleccion, MemoriaNarrativa).

import type { narrativa, supervivencia } from "txnucleo";
import type { Habilidad, Personalidad, Trabajo } from "./datos/esquema.ts";

export interface ConfigMundo {
  readonly semilla: number;
  readonly tam: number;
  /** Segundos reales por día de juego (a velocidad x1). */
  readonly segundosPorDia: number;
  readonly tribus: number;
  readonly colonosPorTribu: number;
  readonly conejos: number;
  readonly ciervos: number;
  readonly jabalies: number;
  readonly lobosBase: number;
  readonly lobosMax: number;
  readonly osos: number;
  /** Días de juego por mes (un año = 12 meses; una estación = 3 meses). */
  readonly diasPorMes: number;
  /** Tope de habitantes por pueblo (para que la simulación siga fluida). */
  readonly topePueblo: number;
}

export const CONFIG_POR_DEFECTO: ConfigMundo = {
  semilla: 20261125,
  tam: 1536,
  segundosPorDia: 1440,
  tribus: 1,
  colonosPorTribu: 8,
  conejos: 110,
  ciervos: 60,
  jabalies: 30,
  lobosBase: 10,
  lobosMax: 40,
  osos: 7,
  diasPorMes: 2,
  topePueblo: 200,
};

export interface Nodo {
  readonly id: string;
  /** arbol | roca | arbusto | hierbas */
  readonly tipo: string;
  /** Variante visual (pino, roble, abedul…). */
  readonly variante: string;
  readonly x: number;
  readonly z: number;
  readonly nodo: supervivencia.NodoRecoleccion;
  espera: number;
  /** Quemado: no da nada hasta reaparecer. */
  quemado: boolean;
}

export interface Apariencia {
  readonly piel: number;
  readonly pelo: number;
  readonly colorPelo: number;
  readonly barba: number;
  readonly complexion: number;
  readonly altura: number;
  readonly sexo: "f" | "m";
}

export interface NivelHabilidad {
  nivel: number;
  xp: number;
  /** 0 nada, 1 interés, 2 pasión. */
  readonly pasion: 0 | 1 | 2;
}

export interface Pensamiento {
  readonly id: string;
  readonly texto: string;
  readonly valor: number;
  /** Tick en que se olvida. */
  readonly hasta: number;
  readonly de?: string;
}

export interface Actividad {
  /** Qué hace (para la simulación y para la animación del visor). */
  readonly tipo: string;
  readonly tarea?: string;
  readonly objetivo?: string;
  destino: { x: number; z: number; alcance: number } | null;
  camino: Array<[number, number]>;
  restante: number;
  hechas: number;
  recalculo: number;
  readonly inicio: number;
  datos: Record<string, unknown>;
}

export interface Colono {
  readonly id: string;
  readonly nombre: string;
  tribu: string;
  /** Tick de nacimiento. */
  readonly nacio: number;
  /** Edad en años al nacer el registro (los fundadores llegan adultos). */
  readonly edadInicial: number;
  readonly apariencia: Apariencia;
  readonly rasgos: string[];
  readonly personalidad: Personalidad;
  readonly trasfondo: { readonly infancia: string; readonly adultez: string | null };
  readonly habilidades: Record<Habilidad, NivelHabilidad>;
  readonly necesidades: supervivencia.Necesidades;
  x: number;
  z: number;
  rumbo: number;
  vida: number;
  temperatura: number;
  vivo: boolean;
  causaMuerte: string | null;
  murio: number | null;
  ultimoDanio: string | null;
  derribado: boolean;
  dormido: boolean;
  actividad: Actividad | null;
  pensamientos: Pensamiento[];
  animo: number;
  crisis: { tipo: string; hasta: number } | null;
  inspiracion: { hasta: number } | null;
  /** Rasgo prestado por el poder "inspirar". */
  rasgoTemporal: { id: string; hasta: number } | null;
  enfermedad: { severidad: number; inmunidad: number } | null;
  carga: Record<string, number>;
  equipo: { arma: string | null; herramienta: string | null; ropa: string | null; armadura: string | null };
  readonly memoria: narrativa.MemoriaNarrativa;
  pareja: string | null;
  readonly padres: string[];
  readonly hijos: string[];
  cama: string | null;
  dijo: { texto: string; tick: number } | null;
  /** Gusto por cada trabajo ya calculado (rasgos + pasión + trasfondo). */
  readonly gustos: Record<Trabajo, number>;
  cooldownGolpe: number;
  proximaDecision: number;
  proximoSocial: number;
  historia: string[];
  stats: Record<string, number>;
  /** Se detuvo ante agua o pared en este paso (transitorio). */
  atascado?: boolean;
}

export interface Tribu {
  readonly id: string;
  nombre: string;
  /** Parte fija del nombre («del Lobo Gris») y rango del título (Clan … Imperio). */
  readonly nucleo: string;
  rango: number;
  readonly color: number;
  readonly simbolo: string;
  centro: { x: number; z: number };
  almacen: Record<string, number>;
  /** Opinión hacia otras tribus (-100..100). */
  relaciones: Record<string, number>;
  lider: string | null;
  extinta: boolean;
  readonly fundada: number;
  ultimaIncursion: number;
  ultimaCaravana: number;
  /** Tecnologías que conoce, la que investiga y cuánto lleva. */
  conoce: string[];
  investigando: string | null;
  conocimiento: number;
  /** Tribu de la que se separó (si nació de un cisma) y ángulo de sus calles. */
  origen: string | null;
  giro: number;
  /** Radio de su muralla (crece con el pueblo). */
  radioMuro: number;
  /** Edad (1 Piedra, 2 Cobre, 3 Hierro, 4 Pólvora); se sube como en AoE. */
  edad?: number;
  stats: Record<string, number>;
}

/** Camino (polilínea) dentro de un pueblo o entre pueblos. */
export interface Camino {
  readonly id: string;
  readonly puntos: Array<[number, number]>;
  readonly tribu: string | null;
}

export interface Tarea {
  readonly id: string;
  readonly tribu: string;
  readonly trabajo: Trabajo;
  /** Subtipo concreto (talar, cosechar, sembrar, cocinar, fabricar, incursion…). */
  readonly tipo: string;
  readonly objetivo: string | null;
  readonly x: number;
  readonly z: number;
  prioridad: number;
  asignado: string | null;
  readonly creada: number;
  readonly datos: Record<string, unknown>;
}

export interface Animal {
  readonly id: string;
  readonly especie: string;
  readonly cuerpo: { x: number; y: number; vx: number; vy: number; velMax: number; fuerzaMax: number };
  vida: number;
  estado: "deambular" | "huir" | "cazar" | "comer";
  objetivo: string | null;
  manada: number;
  deambular: { angulo: number };
  cooldown: number;
  panico: number;
  ultimoAtacante: string | null;
}

export interface Estructura {
  readonly id: string;
  readonly tipo: string;
  /** Puede cambiar de dueño (conquista). */
  tribu: string | null;
  readonly x: number;
  readonly z: number;
  readonly rot: number;
  /** 0..1 (1 = terminada). */
  progreso: number;
  /** Materiales ya entregados para la obra. */
  entregado: Record<string, number>;
  vida: number;
  combustible: number;
  /** Huerto: 0 vacío, (0..1) creciendo, 1 listo. */
  cultivo: number;
  ocupantes: string[];
}

export interface Cuerpo {
  readonly id: string;
  readonly tipo: "animal" | "colono" | "bolsa";
  readonly nombre: string;
  readonly x: number;
  readonly z: number;
  contenido: Record<string, number>;
  readonly expira: number;
  /** Colono muerto (para resucitar). */
  readonly colono?: string;
}

export interface Incendio {
  readonly x: number;
  readonly z: number;
  intensidad: number;
}

export interface Clima {
  tipo: "despejado" | "nublado" | "lluvia" | "tormenta" | "nieve" | "niebla";
  hasta: number;
  /** Desvío de temperatura por olas de frío/calor (poderes y narrador). */
  ola: number;
  olaHasta: number;
  /** Tick hasta el que dura la sequía. */
  sequiaHasta: number;
}

export interface EventoMundo {
  readonly seq: number;
  readonly tick: number;
  readonly dia: number;
  readonly hora: string;
  readonly tipo: string;
  readonly texto: string;
  readonly x?: number;
  readonly z?: number;
  readonly actores: readonly string[];
  /** 0..3: cuánto le interesa al director de cámara. */
  readonly interes: number;
  readonly tribu?: string;
  readonly datos?: Readonly<Record<string, unknown>>;
}
