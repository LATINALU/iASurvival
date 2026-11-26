// Terreno del mundo: cuadrícula de celdas de 1 m con altura, bioma y temperatura base, generada con el ruido de
// TxNucleo (fBm con deformación de dominio para costas y cordilleras naturales). El clima depende de la latitud
// (norte frío, sur cálido) y de la humedad: de ahí salen tundra, taiga, praderas, bosques, selva, sabana y
// desierto; las montañas aparecen solo donde el terreno sube mucho (la mayor parte es llana y habitable).

import { mundo } from "txnucleo";
import { pasada1Nativa } from "./nativo.ts";

export const BIOMAS = ["agua", "pradera", "bosque", "roca", "denso", "pantano", "arena", "desierto", "nieve", "taiga", "sabana", "selva"] as const;
export type Bioma = (typeof BIOMAS)[number];

export interface Terreno {
  readonly tam: number;
  readonly semilla: number;
  /** Altura en metros por celda (fila-mayor: z * tam + x). */
  readonly alturas: Float32Array;
  /** Índice en BIOMAS por celda. */
  readonly biomas: Uint8Array;
  /** Desvío de temperatura por celda (°C): latitud, altura y bioma. */
  readonly clima: Int8Array;
}

/** Genera el terreno de forma determinista a partir de la semilla. Las escalas están en metros (no relativas al
 *  tamaño): en un mapa grande hay más continentes, cordilleras y ríos, no los mismos estirados.
 *  - Continentes con deformación de dominio y un mar en uno de los bordes (costa).
 *  - Cordilleras con crestas (ruido "ridged") que dejan pasos de montaña.
 *  - Ríos largos que serpentean y tienen VADOS cada ~140 m (se cruzan a pie).
 *  - Lagos donde el terreno se hunde; valles llanos y fértiles para las ciudades (más del 75 % es llano). */
export function generarTerreno(semilla: number, tam = 576): Terreno {
  const alturas = new Float32Array(tam * tam);
  const biomas = new Uint8Array(tam * tam);
  const clima = new Int8Array(tam * tam);
  const giro = ((semilla * 2654435761) >>> 0) / 4294967296;
  const ox = giro * 1000, oz = (1 - giro) * 1000;
  // Mar: un borde según la semilla (0 norte, 1 este, 2 sur, 3 oeste).
  const ladoMar = Math.floor(giro * 4);
  // Ríos: uno cada ~420 m de mapa, alternando la orientación.
  const nRios = Math.max(2, Math.round(tam / 420));
  const rios = Array.from({ length: nRios }, (_, k) => ({
    vertical: k % 2 === 0,
    base: (k + 0.6) / (nRios + 0.2),
    onda: 80 + 35 * k,
    fase: semilla * 1.7 + k * 2.3,
  }));
  // Pasada 1: elevación cruda, ríos, latitud y humedad (en Rust si está el núcleo nativo; si no, aquí mismo).
  const nat = pasada1Nativa(semilla, tam, ox, oz, ladoMar, rios.map((r) => [r.vertical ? 1 : 0, r.base, r.onda, r.fase] as const));
  const elev = nat?.elev ?? new Float32Array(tam * tam);
  const latA = nat?.lat ?? new Float32Array(tam * tam);
  const humA = nat?.hum ?? new Float32Array(tam * tam);
  const rioA = nat?.rio ?? new Uint8Array(tam * tam);
  const centrosRio = nat ? [] : rios.map((r) => Array.from({ length: tam }, (_, t) => r.base * tam + Math.sin(t / r.onda + r.fase) * tam * 0.05 + (mundo.fbm(t / 170 + r.fase, 3.1, { semilla: semilla + 9 }) - 0.5) * 180));
  for (let z = 0; z < (nat ? 0 : tam); z++) {
    for (let x = 0; x < tam; x++) {
      const i = z * tam + x;
      const e0 = mundo.ruidoDeformado(x / 420 + ox, z / 420 + oz, 2.2, semilla);
      const detalle = mundo.fbm(x / 26 + ox, z / 26 + oz, { semilla: semilla + 3, octavas: 3 });
      const cresta = 1 - Math.abs(2 * mundo.fbm(x / 190 + oz, z / 190 + ox, { semilla: semilla + 11, octavas: 3 }) - 1);
      const mascara = mundo.fbm(x / 650 + 7, z / 650 + 3, { semilla: semilla + 13, octavas: 2 });
      let e = e0 * 0.82 + detalle * 0.12 + Math.max(0, mascara - 0.58) * 1.5 * cresta ** 4;
      const dBorde = [z, tam - 1 - x, tam - 1 - z, x];
      const dMar = dBorde[ladoMar] / tam;
      e -= Math.max(0, 0.09 - dMar) * 3.2 + (mundo.fbm(x / 60, z / 60, { semilla: semilla + 17 }) - 0.5) * 0.08 * (dMar < 0.12 ? 1 : 0);
      const borde = Math.min(...dBorde.filter((_, k) => k !== ladoMar)) / tam;
      e += Math.max(0, 0.03 - borde) * 6;
      elev[i] = e;
      let dRio = Infinity, vado = false;
      for (let k = 0; k < rios.length; k++) {
        const r = rios[k];
        const t = r.vertical ? z : x, u = r.vertical ? x : z;
        const centro = centrosRio[k][t];
        const d = Math.abs(u - centro);
        if (d < dRio) { dRio = d; vado = (t % 140) < 7; }
      }
      const anchoRio = 1.6 + mundo.fbm(x / 90, z / 90, { semilla: semilla + 19 }) * 1.6;
      if (dRio < anchoRio && x > 4 && z > 4 && x < tam - 4 && z < tam - 4) rioA[i] = vado ? 2 : 1;
      latA[i] = z / tam + (mundo.fbm(x / 300 + 50, z / 300, { semilla: semilla + 31, octavas: 3 }) - 0.5) * 0.3;
      humA[i] = mundo.fbm(x / 240 + 40 + ox, z / 240 + 40, { semilla: semilla + 5, octavas: 4 }) + (dRio < 18 ? 0.12 : 0) + (dMar < 0.14 ? 0.08 : 0);
    }
  }
  // Normalización: cada mundo tiene ~9 % de agua y ~15 % de montaña, sea cual sea la semilla.
  const muestra: number[] = [];
  for (let k = 0; k < 20000; k++) muestra.push(elev[Math.floor(((k * 2654435761) >>> 0) % elev.length)]);
  muestra.sort((a, b) => a - b);
  const q = (f: number): number => muestra[Math.min(muestra.length - 1, Math.floor(f * muestra.length))];
  const qa = q(0.09), qm = q(0.85), qmax = q(0.999), qmin = q(0.0);
  const remap = (e: number): number =>
    e < qa ? 0.33 * Math.max(0, (e - qmin) / Math.max(1e-6, qa - qmin)) :
    e < qm ? 0.33 + ((e - qa) / Math.max(1e-6, qm - qa)) * 0.29 :
    0.62 + Math.min(1.2, (e - qm) / Math.max(1e-6, qmax - qm)) * 0.26;
  // Pasada 2: biomas y alturas.
  for (let i = 0; i < tam * tam; i++) {
    const e = remap(elev[i]);
    const lat = latA[i], humedad = humA[i];
    const enRio = rioA[i] !== 0 && e < 0.7, vado = rioA[i] === 2;
    let b: Bioma;
    if (enRio && vado) b = "arena";
    else if (e < 0.33 || enRio) b = "agua";
    else if (e > 0.7) b = lat < 0.25 || e > 0.8 ? "nieve" : "roca";
    else if (e > 0.64) b = "roca";
    else if (e < 0.35) b = humedad > 0.62 && lat > 0.3 ? "pantano" : "arena";
    else if (lat < 0.13) b = humedad > 0.45 ? "taiga" : "nieve";
    else if (lat < 0.3) b = humedad > 0.5 ? "taiga" : humedad > 0.38 ? "bosque" : "pradera";
    else if (lat < 0.62) b = humedad > 0.66 ? (e < 0.42 ? "pantano" : "denso") : humedad > 0.52 ? "bosque" : "pradera";
    else b = humedad < 0.42 ? "desierto" : humedad < 0.52 ? "sabana" : humedad > 0.6 ? "selva" : "sabana";
    biomas[i] = BIOMAS.indexOf(b);
    const llano = Math.max(0, e - 0.33);
    alturas[i] = b === "agua" ? -0.4 : enRio ? -0.05 : e < 0.62 ? llano * 7 : 2.03 + (e - 0.62) * 45;
    const tc = (lat - 0.5) * 15 - Math.max(0, alturas[i] - 3) * 0.6 + (b === "desierto" ? 6 : b === "selva" ? 4 : b === "nieve" ? -6 : 0);
    clima[i] = Math.max(-100, Math.min(100, Math.round(tc)));
  }
  return { tam, semilla, alturas, biomas, clima };
}

/** Desvío de temperatura (°C) del lugar respecto de la media del mundo. */
export function climaEn(t: Terreno, x: number, z: number): number {
  const cx = Math.max(0, Math.min(t.tam - 1, Math.floor(x))), cz = Math.max(0, Math.min(t.tam - 1, Math.floor(z)));
  return t.clima[cz * t.tam + cx];
}

export function biomaEn(t: Terreno, x: number, z: number): Bioma {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= t.tam || cz >= t.tam) return "roca";
  return BIOMAS[t.biomas[cz * t.tam + cx]];
}

export function alturaEn(t: Terreno, x: number, z: number): number {
  const cx = Math.max(0, Math.min(t.tam - 1, Math.floor(x))), cz = Math.max(0, Math.min(t.tam - 1, Math.floor(z)));
  return t.alturas[cz * t.tam + cx];
}

/** Se puede caminar por la celda (todo menos agua y fuera del mapa). */
export function caminable(t: Terreno, cx: number, cz: number): boolean {
  if (cx < 1 || cz < 1 || cx >= t.tam - 1 || cz >= t.tam - 1) return false;
  return t.biomas[cz * t.tam + cx] !== 0;
}

/** Hay agua a menos de `radio` metros (para beber). */
export function aguaCerca(t: Terreno, x: number, z: number, radio = 1.8): boolean {
  const r = Math.ceil(radio);
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
      if (cx < 0 || cz < 0 || cx >= t.tam || cz >= t.tam) continue;
      if (t.biomas[cz * t.tam + cx] === 0 && Math.hypot(cx + 0.5 - x, cz + 0.5 - z) <= radio + 0.5) return true;
    }
  }
  return false;
}

/** Celda de agua más cercana (para que la IA sepa a dónde ir a beber). */
export function aguaMasCercana(t: Terreno, x: number, z: number, maxRadio: number): { x: number; z: number; distancia: number } | null {
  let mejor: { x: number; z: number; distancia: number } | null = null;
  const r = Math.ceil(maxRadio);
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
      if (cx < 0 || cz < 0 || cx >= t.tam || cz >= t.tam || t.biomas[cz * t.tam + cx] !== 0) continue;
      const d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z);
      if (d <= maxRadio && (!mejor || d < mejor.distancia)) mejor = { x: cx + 0.5, z: cz + 0.5, distancia: d };
    }
  }
  return mejor;
}
