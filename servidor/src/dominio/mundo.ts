// El mundo: estado completo + utilidades comunes (tiempo, estaciones, eventos, caminos, almacén). Reglas puras: el
// tiempo llega como `dt` y el azar es el `AzarMundo` interno con semilla. Los sistemas (colonos, trabajo, social,
// tribus, fauna, clima, narrador) viven en sus archivos y se registran en `paso`.

import { YACIMIENTOS } from "./catalogo.ts";
import { modelos, navegacion, supervivencia } from "txnucleo";
import { AzarMundo } from "./azar.ts";
import { GrillaNativa } from "./nativo.ts";
import { ESTRUCTURAS, recibe } from "./catalogo.ts";
import { biomaEn, caminable, climaEn, generarTerreno, type Terreno } from "./terreno.ts";
import type { Animal, Camino, Clima, Colono, ConfigMundo, Cuerpo, Estructura, EventoMundo, Incendio, Nodo, Tarea, Tribu } from "./tipos.ts";

/** Ticks por segundo de la simulación. */
export const HZ = 5;
export const DT = 1 / HZ;
export const MAX_BITACORA = 4000;
export const ESTACIONES = ["primavera", "verano", "otoño", "invierno"] as const;
/** El año empieza en marzo (primavera). */
export const MESES = ["marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre", "enero", "febrero"] as const;
const TEMP_ESTACION: Record<string, number> = { primavera: 14, verano: 23, otoño: 11, invierno: 0 };

export const r1 = (v: number): number => Math.round(v * 10) / 10;
export const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Planta de las construcciones con paredes: medio ancho (x), medio fondo (z) y lado de la puerta. */
export const HUELLAS: Readonly<Record<string, { ax: number; az: number; puerta: "x" | "z" }>> = {
  centro: { ax: 3.1, az: 2.7, puerta: "z" },
  choza: { ax: 1.5, az: 1.5, puerta: "z" },
  cabana: { ax: 1.8, az: 1.75, puerta: "x" },
  casa: { ax: 2.1, az: 1.95, puerta: "z" },
  casa_grande: { ax: 2.95, az: 2.45, puerta: "z" },
  granero: { ax: 2.0, az: 1.6, puerta: "z" },
};

/** Conjunto que avisa cada vez que se agrega algo. */
class ConjuntoAvisador extends Set<string> {
  private readonly alAgregar?: (v: string) => void;
  constructor(alAgregar: (v: string) => void) {
    super();
    this.alAgregar = alAgregar;
  }
  override add(v: string): this {
    this.alAgregar?.(v);
    return super.add(v);
  }
}

export class Mundo {
  readonly config: ConfigMundo;
  readonly terreno: Terreno;
  readonly azar: AzarMundo;
  readonly ciclo: supervivencia.CicloDia;
  tick = 0;
  readonly nodos = new Map<string, Nodo>();
  readonly colonos = new Map<string, Colono>();
  readonly tribus = new Map<string, Tribu>();
  readonly animales = new Map<string, Animal>();
  readonly estructuras = new Map<string, Estructura>();
  readonly cuerpos = new Map<string, Cuerpo>();
  readonly tareas = new Map<string, Tarea>();
  readonly incendios = new Map<string, Incendio>();
  readonly caminos = new Map<string, Camino>();
  /** Por celda: 0 libre, 1 muro, 2 puerta. */
  readonly bloqueo: Uint8Array;
  /** Por celda: 1 si hay camino (se anda más rápido). */
  readonly enCamino: Uint8Array;
  private readonly costoBase: Float32Array;
  /** Bloqueo fijo (yacimientos): se hornea una vez y al aparecer vetas nuevas. */
  private readonly bloqueoBase: Uint8Array;
  /** Celdas tocadas en el último recálculo del trazado (solo esas se restauran: nada de copiar toda la grilla). */
  private marcadas: number[] = [];
  /** A* en Rust (null si no está el núcleo nativo). */
  private nativa: GrillaNativa | null = null;
  private readonly celdasCamino: number[] = [];
  private readonly costos: Float32Array;
  /** Sube cuando cambian muros o caminos (para que el visor los vuelva a pedir). */
  versionTrazado = 0;
  clima: Clima = { tipo: "despejado", hasta: 0, ola: 0, olaHasta: 0, sequiaHasta: 0 };
  readonly bitacora: EventoMundo[] = [];
  seqBitacora = 0;
  readonly contadores: Record<string, number> = {};
  private pendientes: EventoMundo[] = [];
  /** Flechas y balas en vuelo. */
  readonly proyectiles: Array<{ id: string; tipo: "flecha" | "bala"; de: string; tribu: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; g: number; danio: number; vida: number }> = [];
  /** Nodos creados durante la partida (vetas nuevas, afloramientos) que el visor todavía no conoce. */
  readonly nodosNuevos = new Set<string>();
  /** Nodos agotados o quemados (los únicos que el sistema de reaparición revisa). */
  readonly agotados = new Set<string>();
  /** Nodos que cambiaron desde el último envío al visor (y, de paso, candidatos a agotados). */
  readonly nodosCambiados: Set<string> = new ConjuntoAvisador((id) => this.agotados.add(id));
  private readonly grafo: navegacion.Grafo<navegacion.Celda2>;
  private readonly vision: (a: navegacion.Celda2, b: navegacion.Celda2) => boolean;
  /** Metas inalcanzables recientes (para no repetir búsquedas que fallan). */
  private readonly fallidos = new Map<string, number>();

  constructor(config: ConfigMundo) {
    this.config = config;
    this.terreno = generarTerreno(config.semilla, config.tam);
    this.azar = new AzarMundo(config.semilla ^ 0x5eed);
    this.ciclo = new supervivencia.CicloDia(config.segundosPorDia, modelos.piezas.DIA_NOCHE, 0.3);
    const costos = new Float32Array(config.tam * config.tam);
    this.bloqueo = new Uint8Array(config.tam * config.tam);
    this.enCamino = new Uint8Array(config.tam * config.tam);
    for (let f = 0; f < config.tam; f++) for (let c = 0; c < config.tam; c++) {
      const b = biomaEn(this.terreno, c + 0.5, f + 0.5);
      costos[f * config.tam + c] = caminable(this.terreno, c, f) ? (b === "pantano" ? 2 : b === "denso" || b === "selva" || b === "nieve" ? 1.3 : b === "desierto" || b === "roca" ? 1.15 : 1) : Infinity;
    }
    this.costoBase = costos;
    this.bloqueoBase = new Uint8Array(config.tam * config.tam);
    this.costos = Float32Array.from(costos);
    const actual = this.costos;
    this.nativa = GrillaNativa.crear(config.tam, this.costos);
    this.grafo = navegacion.grafoGrilla({ cols: config.tam, filas: config.tam, diagonal: true, costo: (c, f) => actual[f * config.tam + c] });
    this.vision = navegacion.visionBresenham((c, f) => caminable(this.terreno, c, f) && actual[f * config.tam + c] < 1.5);
  }

  // ------------------------------------------------------------ ids y tiempo

  nuevoId(prefijo: string): string {
    this.contadores[prefijo] = (this.contadores[prefijo] ?? 0) + 1;
    return `${prefijo}${this.contadores[prefijo]}`;
  }

  /** Ticks que dura un día de juego. */
  get ticksDia(): number {
    return this.config.segundosPorDia * HZ;
  }

  get hora(): string {
    const m = Math.floor(this.ciclo.tiempo * 24 * 60);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }

  get esNoche(): boolean {
    return this.ciclo.fase.nombre === "noche";
  }

  /** Mes (0 = marzo … 11 = febrero). */
  get mesIndice(): number {
    return Math.floor((this.ciclo.dia - 1) / this.config.diasPorMes) % 12;
  }

  get mes(): string {
    return MESES[this.mesIndice];
  }

  get diaDelMes(): number {
    return ((this.ciclo.dia - 1) % this.config.diasPorMes) + 1;
  }

  get estacion(): (typeof ESTACIONES)[number] {
    return ESTACIONES[Math.floor(this.mesIndice / 3)];
  }

  get anio(): number {
    return Math.floor((this.ciclo.dia - 1) / (this.config.diasPorMes * 12)) + 1;
  }

  /** Ticks que dura un año de calendario. */
  get ticksAnio(): number {
    return this.ticksDia * this.config.diasPorMes * 12;
  }

  /** Fecha legible: «2 de abril del año 3». */
  get fecha(): string {
    return `${this.diaDelMes} de ${this.mes} del año ${this.anio}`;
  }

  get sequia(): boolean {
    return this.tick < this.clima.sequiaHasta;
  }

  get lloviendo(): boolean {
    return this.clima.tipo === "lluvia" || this.clima.tipo === "tormenta";
  }

  /** Temperatura ambiente en °C (estación + día/noche + clima + olas). */
  get temperatura(): number {
    const ola = this.tick < this.clima.olaHasta ? this.clima.ola : 0;
    const clima = this.clima.tipo === "lluvia" ? -3 : this.clima.tipo === "tormenta" ? -4 : this.clima.tipo === "nieve" ? -5 : this.clima.tipo === "nublado" ? -1 : 0;
    return TEMP_ESTACION[this.estacion] + (this.ciclo.luz - 0.55) * 14 + clima + ola;
  }

  /** Temperatura en un lugar: la del mundo + latitud, altura y bioma. */
  temperaturaEn(x: number, z: number): number {
    return this.temperatura + climaEn(this.terreno, x, z);
  }

  /** Edad en años de calendario (12 meses). */
  edad(c: Colono): number {
    return c.edadInicial + ((c.vivo ? this.tick : c.murio ?? this.tick) - c.nacio) / this.ticksAnio;
  }

  esNino(c: Colono): boolean {
    return this.edad(c) < 14;
  }

  // ------------------------------------------------------------ eventos

  emitir(tipo: string, texto: string, op: { x?: number; z?: number; actores?: string[]; interes?: number; tribu?: string; datos?: Record<string, unknown> } = {}): EventoMundo {
    const ev: EventoMundo = {
      seq: ++this.seqBitacora, tick: this.tick, dia: this.ciclo.dia, hora: this.hora, tipo, texto,
      x: op.x === undefined ? undefined : r1(op.x), z: op.z === undefined ? undefined : r1(op.z),
      actores: op.actores ?? [], interes: op.interes ?? 1, tribu: op.tribu, datos: op.datos,
    };
    this.bitacora.push(ev);
    if (this.bitacora.length > MAX_BITACORA) this.bitacora.splice(0, this.bitacora.length - MAX_BITACORA);
    this.pendientes.push(ev);
    if (ev.interes >= 2) {
      for (const id of ev.actores) {
        const c = this.colonos.get(id);
        if (c) {
          c.historia.push(`Día ${ev.dia}, ${ev.hora}: ${texto}`);
          if (c.historia.length > 40) c.historia.shift();
        }
      }
    }
    return ev;
  }

  sacarPendientes(): EventoMundo[] {
    const p = this.pendientes;
    this.pendientes = [];
    return p;
  }

  // ------------------------------------------------------------ consultas

  vivos(): Colono[] {
    return [...this.colonos.values()].filter((c) => c.vivo);
  }

  miembros(tribu: string): Colono[] {
    return [...this.colonos.values()].filter((c) => c.vivo && c.tribu === tribu);
  }

  /** Dónde está el almacén de una tribu (el edificio, o el centro si aún no existe). */
  /** Tope de población de una tribu: camas de sus viviendas terminadas (mínimo 8 al fundar), con el tope global. */
  capacidad(t: Tribu): number {
    let camas = 0;
    for (const e of this.estructuras.values()) {
      if (e.tribu !== t.id || e.progreso < 1) continue;
      const d = ESTRUCTURAS.get(e.tipo);
      if (d?.vivienda) camas += d.camas ?? 0;
    }
    return Math.min(this.config.topePueblo, Math.max(8, camas));
  }

  /** Punto de entrega más cercano que recibe TODO lo que lleva (si no, el almacén o el centro). */
  entregaPara(t: Tribu, x: number, z: number, objetos: readonly string[]): Estructura | null {
    let mejor: Estructura | null = null, md = Infinity;
    for (const e of this.estructuras.values()) {
      if (e.tribu !== t.id || e.progreso < 1) continue;
      const d = ESTRUCTURAS.get(e.tipo);
      if (!d?.entrega || !objetos.every((o) => recibe(d, o))) continue;
      const dd = Math.hypot(e.x - x, e.z - z);
      if (dd < md) { md = dd; mejor = e; }
    }
    return mejor;
  }

  almacenDe(t: Tribu): { x: number; z: number } {
    for (const e of this.estructuras.values()) if (e.tribu === t.id && e.tipo === "almacen" && e.progreso >= 1) return { x: e.x, z: e.z };
    return t.centro;
  }

  /** Fuego encendido (fogata o cocina) más cercano a menos de `radio`. */
  fuegoCerca(x: number, z: number, radio: number, tribu?: string): Estructura | null {
    let mejor: Estructura | null = null, md = Infinity;
    for (const e of radio <= 40 ? this.estructurasCerca(x, z, radio) : this.estructuras.values()) {
      if (!ESTRUCTURAS.get(e.tipo)?.fuego || e.progreso < 1 || e.combustible <= 0) continue;
      if (tribu && e.tribu !== tribu) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d <= radio && d < md) { md = d; mejor = e; }
    }
    return mejor;
  }

  // ------------------------------------------------------------ índices espaciales (por tick)

  private rejilla: { tick: number; col: Map<number, Colono[]>; ani: Map<number, Animal[]> } | null = null;
  private rejillaE: { n: number; tick: number; mapa: Map<number, Estructura[]> } | null = null;

  private armarRejilla(): { col: Map<number, Colono[]>; ani: Map<number, Animal[]> } {
    if (this.rejilla && this.rejilla.tick === this.tick) return this.rejilla;
    const col = new Map<number, Colono[]>(), ani = new Map<number, Animal[]>();
    for (const c of this.colonos.values()) {
      if (!c.vivo) continue;
      const k = Math.floor(c.z / 32) * 4096 + Math.floor(c.x / 32);
      (col.get(k) ?? col.set(k, []).get(k)!).push(c);
    }
    for (const b of this.animales.values()) {
      const k = Math.floor(b.cuerpo.y / 32) * 4096 + Math.floor(b.cuerpo.x / 32);
      (ani.get(k) ?? ani.set(k, []).get(k)!).push(b);
    }
    this.rejilla = { tick: this.tick, col, ani };
    return this.rejilla;
  }

  private cerca<T>(mapa: Map<number, T[]>, x: number, z: number, r: number): T[] {
    const res: T[] = [];
    for (let cz = Math.floor((z - r) / 32); cz <= Math.floor((z + r) / 32); cz++)
      for (let cx = Math.floor((x - r) / 32); cx <= Math.floor((x + r) / 32); cx++) {
        const l = mapa.get(cz * 4096 + cx);
        if (l) for (const v of l) res.push(v);
      }
    return res;
  }

  /** Colonos vivos en las celdas que cubren el radio (filtrar por distancia exacta si hace falta). */
  colonosCerca(x: number, z: number, r: number): Colono[] {
    return this.cerca(this.armarRejilla().col, x, z, r);
  }

  animalesCerca(x: number, z: number, r: number): Animal[] {
    return this.cerca(this.armarRejilla().ani, x, z, r);
  }

  estructurasCerca(x: number, z: number, r: number): Estructura[] {
    if (!this.rejillaE || this.rejillaE.n !== this.estructuras.size || this.tick - this.rejillaE.tick > 50) {
      const mapa = new Map<number, Estructura[]>();
      for (const e of this.estructuras.values()) {
        const k = Math.floor(e.z / 32) * 4096 + Math.floor(e.x / 32);
        (mapa.get(k) ?? mapa.set(k, []).get(k)!).push(e);
      }
      this.rejillaE = { n: this.estructuras.size, tick: this.tick, mapa };
    }
    return this.cerca(this.rejillaE.mapa, x, z, r);
  }

  /** Construcción terminada con abrigo en cuyo radio está (x,z). */
  refugioEn(x: number, z: number): Estructura | null {
    let mejor: Estructura | null = null, ma = 0;
    for (const e of this.estructurasCerca(x, z, 6)) {
      const def = ESTRUCTURAS.get(e.tipo)!;
      if (e.progreso < 1 || !def.aislamiento) continue;
      if (Math.hypot(e.x - x, e.z - z) <= def.radio + 0.3 && def.aislamiento > ma) { ma = def.aislamiento; mejor = e; }
    }
    return mejor;
  }

  aSalvo(x: number, z: number): boolean {
    const r = this.refugioEn(x, z);
    return !!r && !!ESTRUCTURAS.get(r.tipo)!.refugio;
  }

  /** Celda caminable al azar (con filtros). */
  lugarLibre(op: { cerca?: { x: number; z: number }; radio?: number; evitar?: ReadonlyArray<{ x: number; z: number }>; minDist?: number; biomas?: readonly string[] } = {}): { x: number; z: number } {
    const tam = this.config.tam;
    for (let i = 0; i < 600; i++) {
      let x: number, z: number;
      if (op.cerca) {
        const a = this.azar.rango(0, Math.PI * 2), r = this.azar.rango(0, op.radio ?? 10);
        x = op.cerca.x + Math.cos(a) * r;
        z = op.cerca.z + Math.sin(a) * r;
      } else {
        x = this.azar.rango(6, tam - 6);
        z = this.azar.rango(6, tam - 6);
      }
      if (!caminable(this.terreno, Math.floor(x), Math.floor(z))) continue;
      if (op.biomas && !op.biomas.includes(biomaEn(this.terreno, x, z))) continue;
      if (op.evitar?.some((e) => Math.hypot(e.x - x, e.z - z) < (op.minDist ?? 0))) continue;
      return { x, z };
    }
    return op.cerca ? { ...op.cerca } : { x: tam / 2, z: tam / 2 };
  }

  // ------------------------------------------------------------ muros, puertas y caminos

  /** Hornea en la grilla base las celdas sólidas de los yacimientos (al generar, al cargar y con vetas nuevas). */
  hornearYacimientos(): void {
    const tam = this.config.tam;
    for (const n of this.nodos.values()) {
      const y = YACIMIENTOS[n.tipo];
      if (!y) continue;
      const r = Math.ceil(y.radio);
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const cx = Math.floor(n.x) + dx, cz = Math.floor(n.z) + dz;
        if (cx < 0 || cz < 0 || cx >= tam || cz >= tam || Math.hypot(cx + 0.5 - n.x, cz + 0.5 - n.z) > y.radio) continue;
        const i = cz * tam + cx;
        this.costoBase[i] = Infinity;
        this.bloqueoBase[i] = 1;
        this.costos[i] = Infinity;
        this.bloqueo[i] = 1;
      }
    }
    this.yacimientosCache = null;
    this.nativa?.sincronizarTodo();
    this.fallidos.clear();
    this.versionTrazado++;
  }

  private yacimientosCache: Nodo[] | null = null;

  /** Yacimientos a menos de `r` (índice propio: son pocos y se buscan lejos). */
  yacimientosCerca(x: number, z: number, r: number, filtro?: (n: Nodo) => boolean): Nodo[] {
    if (!this.yacimientosCache) this.yacimientosCache = [...this.nodos.values()].filter((n) => n.tipo in YACIMIENTOS);
    return this.yacimientosCache.filter((n) => Math.hypot(n.x - x, n.z - z) <= r && (!filtro || filtro(n)));
  }

  /** Se puede pisar: tierra firme, sin muro ni pared de casa. */
  pisable(x: number, z: number): boolean {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!caminable(this.terreno, cx, cz)) return false;
    return Number.isFinite(this.costos[cz * this.config.tam + cx]);
  }

  /** Celdas de las paredes de una casa (anillo alrededor de su planta, con hueco en la puerta). */
  private celdasPared(e: Estructura): Array<[number, number]> {
    const h = HUELLAS[e.tipo];
    if (!h) return [];
    const ux = Math.cos(e.rot), uz = -Math.sin(e.rot);
    const vx = Math.sin(e.rot), vz = Math.cos(e.rot);
    const aMundo = (lx: number, lz: number): [number, number] => [e.x + ux * lx + vx * lz, e.z + uz * lx + vz * lz];
    const puerta = aMundo(h.puerta === "x" ? h.ax : 0, h.puerta === "x" ? 0 : h.az);
    const celdaPuerta = [Math.floor(puerta[0]), Math.floor(puerta[1])];
    const r: Array<[number, number]> = [];
    // Pasillo libre del centro, por la puerta, hasta 1.5 m afuera: celdas contiguas por lado (sin depender de
    // diagonales), así nadie queda encerrado sea cual sea la orientación de la casa.
    const vistos = new Set<string>();
    const fondo = (h.puerta === "x" ? h.ax : h.az) + 1.5;
    let previa: [number, number] | null = null;
    for (let k = 0; k <= fondo + 0.01; k += 0.2) {
      const [x, z] = aMundo(h.puerta === "x" ? k : 0, h.puerta === "x" ? 0 : k);
      const c: [number, number] = [Math.floor(x), Math.floor(z)];
      if (previa && previa[0] !== c[0] && previa[1] !== c[1]) vistos.add(`${c[0]},${previa[1]}`);
      vistos.add(`${c[0]},${c[1]}`);
      previa = c;
    }
    const borde: Array<[number, number]> = [];
    for (let s = -h.ax; s <= h.ax + 0.01; s += 0.35) { borde.push([s, -h.az], [s, h.az]); }
    for (let s = -h.az; s <= h.az + 0.01; s += 0.35) { borde.push([-h.ax, s], [h.ax, s]); }
    for (const [lx, lz] of borde) {
      const [x, z] = aMundo(lx, lz);
      if (Math.hypot(x - puerta[0], z - puerta[1]) < 0.75) continue;
      const c: [number, number] = [Math.floor(x), Math.floor(z)];
      if (c[0] === celdaPuerta[0] && c[1] === celdaPuerta[1]) continue;
      const k = `${c[0]},${c[1]}`;
      if (!vistos.has(k)) { vistos.add(k); r.push(c); }
    }
    return r;
  }

  /** Celdas que ocupa un muro o una puerta (a lo largo de su orientación). */
  private celdasMuro(e: Estructura): Array<[number, number]> {
    const dx = Math.cos(e.rot), dz = -Math.sin(e.rot);
    const largo = e.tipo === "puerta" || e.tipo === "portal" ? 1.3 : 1.1;
    const r: Array<[number, number]> = [];
    for (let k = -largo; k <= largo + 0.01; k += 0.5) {
      const c: [number, number] = [Math.floor(e.x + dx * k), Math.floor(e.z + dz * k)];
      if (!r.some((p) => p[0] === c[0] && p[1] === c[1])) r.push(c);
    }
    return r;
  }

  /** Recalcula muros, puertas y caminos en la grilla de paso (después de construir o destruir). */
  recalcularTrazado(): void {
    const tam = this.config.tam;
    // Restaura solo lo que se tocó la vez anterior.
    const viejas = this.marcadas;
    for (const i of viejas) { this.costos[i] = this.costoBase[i]; this.bloqueo[i] = this.bloqueoBase[i]; }
    const marcadas: number[] = [];
    this.marcadas = marcadas;
    const marcar = (i: number, bloqueo: number, costo: number): void => {
      marcadas.push(i);
      this.bloqueo[i] = bloqueo;
      this.costos[i] = costo;
    };
    for (const i of this.celdasCamino) if (Number.isFinite(this.costoBase[i])) marcar(i, this.bloqueoBase[i], this.costoBase[i] * 0.7);
    // Paredes de casas: nadie las atraviesa; se entra por la puerta (los animales no entran).
    for (const e of this.estructuras.values()) {
      if (e.progreso < 1 || !HUELLAS[e.tipo]) continue;
      for (const [cx, cz] of this.celdasPared(e)) {
        if (cx < 0 || cz < 0 || cx >= tam || cz >= tam) continue;
        marcar(cz * tam + cx, 1, Infinity);
      }
    }
    for (const e of this.estructuras.values()) {
      if (e.progreso < 1 || !(e.tipo === "empalizada" || e.tipo === "muralla" || e.tipo === "portal" || e.tipo === "puerta")) continue;
      const puerta = e.tipo === "portal" || e.tipo === "puerta";
      for (const [cx, cz] of this.celdasMuro(e)) {
        if (cx < 0 || cz < 0 || cx >= tam || cz >= tam) continue;
        const i = cz * tam + cx;
        if (this.bloqueo[i] === 2) continue;
        marcar(i, puerta ? 2 : 1, puerta ? this.costos[i] : Infinity);
      }
    }
    this.nativa?.fijar(viejas.length ? viejas.concat(marcadas) : marcadas);
    this.fallidos.clear();
    this.versionTrazado++;
  }

  /** Un animal no puede pasar por muros ni puertas. */
  bloqueaAnimal(x: number, z: number): boolean {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= this.config.tam || cz >= this.config.tam) return true;
    return this.bloqueo[cz * this.config.tam + cx] !== 0;
  }

  /** Agrega (o reemplaza) un camino y marca sus celdas. */
  agregarCamino(id: string, puntos: Array<[number, number]>, tribu: string | null): void {
    this.caminos.set(id, { id, puntos, tribu });
    const tam = this.config.tam;
    for (let k = 0; k + 1 < puntos.length; k++) {
      const [x0, z0] = puntos[k], [x1, z1] = puntos[k + 1];
      const pasos = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2);
      for (let s = 0; s <= pasos; s++) {
        const x = x0 + ((x1 - x0) * s) / Math.max(1, pasos), z = z0 + ((z1 - z0) * s) / Math.max(1, pasos);
        const cx = Math.floor(x), cz = Math.floor(z);
        if (cx >= 0 && cz >= 0 && cx < tam && cz < tam && !this.enCamino[cz * tam + cx]) { this.enCamino[cz * tam + cx] = 1; this.celdasCamino.push(cz * tam + cx); }
      }
    }
    this.recalcularTrazado();
  }

  /** Quita una construcción (fuego, meteorito, terremoto, demolición). */
  quitarEstructura(id: string): void {
    const e = this.estructuras.get(id);
    if (!e) return;
    this.estructuras.delete(id);
    for (const c of this.colonos.values()) if (c.cama === id) c.cama = null;
    if (e.tipo === "empalizada" || e.tipo === "muralla" || e.tipo === "portal" || e.tipo === "puerta" || HUELLAS[e.tipo]) this.recalcularTrazado();
  }

  // ------------------------------------------------------------ índice espacial de nodos

  private cubetas: { n: number; mapa: Map<number, Nodo[]> } | null = null;

  /** Nodos de recursos a menos de `r` de (x, z) (índice por cubetas de 16 m). */
  nodosCerca(x: number, z: number, r: number, filtro?: (n: Nodo) => boolean): Nodo[] {
    const T = 16;
    if (!this.cubetas || this.cubetas.n !== this.nodos.size) {
      const mapa = new Map<number, Nodo[]>();
      for (const n of this.nodos.values()) {
        const k = Math.floor(n.z / T) * 1000 + Math.floor(n.x / T);
        (mapa.get(k) ?? mapa.set(k, []).get(k)!).push(n);
      }
      this.cubetas = { n: this.nodos.size, mapa };
    }
    const r2 = r * r;
    const res: Nodo[] = [];
    for (let cz = Math.floor((z - r) / T); cz <= Math.floor((z + r) / T); cz++) {
      for (let cx = Math.floor((x - r) / T); cx <= Math.floor((x + r) / T); cx++) {
        for (const n of this.cubetas.mapa.get(cz * 1000 + cx) ?? []) {
          const dx = n.x - x, dz = n.z - z;
          if (dx * dx + dz * dz <= r2 && (!filtro || filtro(n))) res.push(n);
        }
      }
    }
    return res;
  }

  // ------------------------------------------------------------ caminos

  camino(x: number, z: number, tx: number, tz: number): Array<[number, number]> | null {
    const t = this.terreno;
    // Viajes largos: se camina por tramos de ~60 m hacia el destino (se recalcula al llegar a cada tramo).
    const largo = Math.hypot(tx - x, tz - z);
    if (largo > 75) {
      const k = 60 / largo;
      let px = x + (tx - x) * k, pz = z + (tz - z) * k;
      for (let i = 0; i < 12 && !caminable(t, Math.floor(px), Math.floor(pz)); i++) { px += this.azar.rango(-4, 4); pz += this.azar.rango(-4, 4); }
      return this.camino(x, z, px, pz);
    }
    const ini: navegacion.Celda2 = [Math.floor(x), Math.floor(z)];
    let meta: navegacion.Celda2 = [Math.floor(tx), Math.floor(tz)];
    const libre = (c: number, f: number): boolean => this.pisable(c + 0.5, f + 0.5);
    if (!libre(meta[0], meta[1])) {
      let mejor: navegacion.Celda2 | null = null, md = Infinity;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const c = meta[0] + dx, f = meta[1] + dz;
        const d = Math.hypot(c + 0.5 - tx, f + 0.5 - tz);
        if (libre(c, f) && d < md) { md = d; mejor = [c, f]; }
      }
      if (!mejor) return null;
      meta = mejor;
    }
    // Atrapado en una celda no pisable (lo alcanzó una pared nueva o un empujón): sale a la libre más cercana.
    let salida: [number, number] | null = null;
    if (!libre(ini[0], ini[1])) {
      let md = Infinity;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const c = ini[0] + dx, f = ini[1] + dz;
        if (libre(c, f) && Math.hypot(dx, dz) < md) { md = Math.hypot(dx, dz); salida = [c + 0.5, f + 0.5]; }
      }
      if (!salida) return [[meta[0] + 0.5, meta[1] + 0.5]];
      const resto = this.camino(salida[0], salida[1], tx, tz);
      return resto ? [salida, ...resto] : [salida];
    }
    if (ini[0] === meta[0] && ini[1] === meta[1]) return [[tx, tz]];
    // Campo abierto: línea recta (sin A*).
    if (this.vision(ini, meta)) return [[meta[0] === Math.floor(tx) && meta[1] === Math.floor(tz) ? tx : meta[0] + 0.5, meta[0] === Math.floor(tx) && meta[1] === Math.floor(tz) ? tz : meta[1] + 0.5]];
    const clave = `${ini[0]},${ini[1]}>${meta[0]},${meta[1]}`;
    if ((this.fallidos.get(clave) ?? -1e9) > this.tick - 300) return null;
    const ruta = this.nativa ? this.nativa.camino(ini[0], ini[1], meta[0], meta[1], 80000) : navegacion.aEstrella(this.grafo, ini, meta, { maxNodos: 6000 });
    if (!ruta) {
      this.fallidos.set(clave, this.tick);
      if (this.fallidos.size > 2000) this.fallidos.clear();
      return null;
    }
    return navegacion.suavizarCamino(ruta, this.vision).slice(1).map(([c, f]): [number, number] => [c + 0.5, f + 0.5]);
  }

  /** Avanza por el camino. true al llegar. */
  avanzarCamino(e: { x: number; z: number; rumbo: number; atascado?: boolean }, camino: Array<[number, number]>, velocidad: number, dt: number): boolean {
    let paso = velocidad * dt;
    while (paso > 0 && camino.length > 0) {
      const [cx, cz] = camino[0];
      const dx = cx - e.x, dz = cz - e.z, d = Math.hypot(dx, dz);
      if (d <= paso) {
        e.x = cx;
        e.z = cz;
        paso -= d;
        camino.shift();
      } else {
        const nx = e.x + (dx / d) * paso, nz = e.z + (dz / d) * paso;
        e.rumbo = Math.atan2(dx, dz);
        if (!this.pisable(nx, nz) && this.pisable(e.x, e.z)) {
          // Delante hay agua o pared: se desliza a lo largo del borde (como un cuerpo que choca contra un muro).
          if (this.pisable(nx, e.z)) e.x = nx;
          else if (this.pisable(e.x, nz)) e.z = nz;
          else {
            camino.length = 0;
            e.atascado = true;
            return false;
          }
          paso = 0;
          continue;
        }
        e.x = nx;
        e.z = nz;
        paso = 0;
      }
    }
    return camino.length === 0;
  }

  // ------------------------------------------------------------ almacén

  hay(t: Tribu, req: Readonly<Record<string, number>>): boolean {
    return Object.entries(req).every(([o, n]) => (t.almacen[o] ?? 0) >= n);
  }

  sacar(t: Tribu, o: string, n: number): number {
    const hay = Math.min(n, t.almacen[o] ?? 0);
    t.almacen[o] = (t.almacen[o] ?? 0) - hay;
    if (t.almacen[o] <= 0) delete t.almacen[o];
    return hay;
  }

  meter(t: Tribu, o: string, n: number): void {
    if (n > 0) t.almacen[o] = (t.almacen[o] ?? 0) + n;
  }

  // ------------------------------------------------------------ paso

  paso(sistemas: ReadonlyArray<(m: Mundo, dt: number) => void>): void {
    this.tick++;
    const antes = this.estacion;
    const mesAntes = this.mesIndice;
    const cambio = this.ciclo.actualizar(DT);
    if (cambio) {
      const textos: Record<string, string> = { amanecer: "Amanece.", dia: "Es de día.", atardecer: "Atardece.", noche: "Cae la noche." };
      this.emitir("fase", textos[cambio] ?? cambio, { interes: 0, datos: { fase: cambio } });
    }
    if (this.mesIndice !== mesAntes) this.emitir("mes", `Comienza ${this.mes} del año ${this.anio}.`, { interes: 0, datos: { mes: this.mes } });
    if (this.estacion !== antes) {
      const nombre = { primavera: "la primavera", verano: "el verano", otoño: "el otoño", invierno: "el invierno" }[this.estacion];
      this.emitir("estacion", `Llega ${nombre} (año ${this.anio}).`, { interes: 2, datos: { estacion: this.estacion } });
    }
    for (const s of sistemas) s(this, DT);
  }
}
