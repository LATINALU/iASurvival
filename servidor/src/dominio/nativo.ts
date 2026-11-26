// Puente con el núcleo nativo en Rust (servidor/nativo → ias_nativo.wasm). Si el .wasm no está o se desactiva con
// IASURVIVAL_SIN_NATIVO=1, todo sigue funcionando con la versión en TypeScript (más lenta).
//  - pasada1Nativa: la pasada pesada de ruido del terreno.
//  - GrillaNativa: A* sobre la grilla de costos del mundo (una copia en la memoria del módulo, que se mantiene al
//    día con los cambios del trazado).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Exportes {
  memory: WebAssembly.Memory;
  reservar(bytes: number): number;
  liberar(p: number, bytes: number): void;
  terreno_pasada1(semilla: number, tam: number, ox: number, oz: number, ladoMar: number, rios: number, nRios: number, elev: number, lat: number, hum: number, rio: number): void;
  campo_fbm(tam: number, escala: number, ox: number, oz: number, semilla: number, octavas: number, out: number): void;
  grilla_iniciar(tam: number): number;
  grilla_costos(): number;
  grilla_fijar(indices: number, valores: number, n: number): void;
  grilla_camino(c0: number, f0: number, c1: number, f1: number, max: number): number;
  grilla_ruta(): number;
}

let ex: Exportes | null | undefined;

function cargar(): Exportes | null {
  if (ex !== undefined) return ex;
  ex = null;
  if (process.env.IASURVIVAL_SIN_NATIVO === "1") return ex;
  const aqui = dirname(fileURLToPath(import.meta.url));
  const candidatos = [join(aqui, "ias_nativo.wasm"), join(aqui, "../../nativo/ias_nativo.wasm"), join(dirname(process.argv[1] ?? "."), "ias_nativo.wasm")];
  for (const ruta of candidatos) {
    if (!existsSync(ruta)) continue;
    try {
      const modulo = new WebAssembly.Module(readFileSync(ruta));
      ex = new WebAssembly.Instance(modulo, {}).exports as unknown as Exportes;
      break;
    } catch {
      ex = null;
    }
  }
  return ex;
}

export const nativoDisponible = (): boolean => cargar() !== null;

/** Pasada 1 del terreno en Rust. `rios` = [vertical, base, onda, fase] por río. */
export function pasada1Nativa(semilla: number, tam: number, ox: number, oz: number, ladoMar: number, rios: ReadonlyArray<readonly [number, number, number, number]>):
  { elev: Float32Array; lat: Float32Array; hum: Float32Array; rio: Uint8Array } | null {
  const e = cargar();
  if (!e) return null;
  const n = tam * tam;
  const pr = e.reservar(rios.length * 32);
  const pe = e.reservar(n * 4), pl = e.reservar(n * 4), ph = e.reservar(n * 4), pi = e.reservar(n);
  new Float64Array(e.memory.buffer, pr, rios.length * 4).set(rios.flat());
  e.terreno_pasada1(semilla, tam, ox, oz, ladoMar, pr, rios.length, pe, pl, ph, pi);
  const elev = new Float32Array(e.memory.buffer, pe, n).slice();
  const lat = new Float32Array(e.memory.buffer, pl, n).slice();
  const hum = new Float32Array(e.memory.buffer, ph, n).slice();
  const rio = new Uint8Array(e.memory.buffer, pi, n).slice();
  e.liberar(pr, rios.length * 32); e.liberar(pe, n * 4); e.liberar(pl, n * 4); e.liberar(ph, n * 4); e.liberar(pi, n);
  return { elev, lat, hum, rio };
}

/** Campo completo de fBm (null sin núcleo nativo). */
export function campoFbmNativo(tam: number, escala: number, ox: number, oz: number, semilla: number, octavas: number): Float32Array | null {
  const e = cargar();
  if (!e) return null;
  const p = e.reservar(tam * tam * 4);
  e.campo_fbm(tam, escala, ox, oz, semilla, octavas, p);
  const r = new Float32Array(e.memory.buffer, p, tam * tam).slice();
  e.liberar(p, tam * tam * 4);
  return r;
}

let duenia: GrillaNativa | null = null;

/** Copia de la grilla de costos en el módulo nativo + A* rápido. Una sola grilla activa a la vez. */
export class GrillaNativa {
  private readonly e: Exportes;
  private staging = 0;
  private stagingCap = 0;

  private readonly tam: number;
  private readonly costos: Float32Array;

  private constructor(e: Exportes, tam: number, costos: Float32Array) {
    this.e = e;
    this.tam = tam;
    this.costos = costos;
  }

  static crear(tam: number, costos: Float32Array): GrillaNativa | null {
    const e = cargar();
    if (!e) return null;
    const g = new GrillaNativa(e, tam, costos);
    g.sincronizarTodo();
    return g;
  }

  /** Sube la grilla entera (al crear, al hornear yacimientos o si otro mundo tomó el módulo). */
  sincronizarTodo(): void {
    const p = this.e.grilla_iniciar(this.tam);
    new Float32Array(this.e.memory.buffer, p, this.tam * this.tam).set(this.costos);
    this.staging = 0;
    this.stagingCap = 0;
    duenia = this;
  }

  /** Copia al módulo los costos de estas celdas. */
  fijar(indices: readonly number[]): void {
    if (duenia !== this) { this.sincronizarTodo(); return; }
    const n = indices.length;
    if (!n) return;
    if (n > this.stagingCap) {
      if (this.staging) this.e.liberar(this.staging, this.stagingCap * 8);
      this.stagingCap = Math.max(1024, n * 2);
      this.staging = this.e.reservar(this.stagingCap * 8);
    }
    const idx = new Uint32Array(this.e.memory.buffer, this.staging, n);
    const val = new Float32Array(this.e.memory.buffer, this.staging + this.stagingCap * 4, n);
    for (let k = 0; k < n; k++) { idx[k] = indices[k]; val[k] = this.costos[indices[k]]; }
    this.e.grilla_fijar(this.staging, this.staging + this.stagingCap * 4, n);
  }

  /** Camino de celda a celda (incluye ambas) o null. */
  camino(c0: number, f0: number, c1: number, f1: number, maxNodos: number): Array<[number, number]> | null {
    if (duenia !== this) this.sincronizarTodo();
    const n = this.e.grilla_camino(c0, f0, c1, f1, maxNodos);
    if (n < 0) return null;
    const pares = new Int32Array(this.e.memory.buffer, this.e.grilla_ruta(), n * 2);
    const r: Array<[number, number]> = new Array(n);
    for (let k = 0; k < n; k++) r[k] = [pares[2 * k], pares[2 * k + 1]];
    return r;
  }
}
