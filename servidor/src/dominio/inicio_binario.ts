// Mensaje de INICIO en binario (mapas grandes): terreno y nodos comprimidos con zlib en un frame binario de
// WebSocket. En 1536 m el JSON pesaba ~17 MB; así son ~1–4 MB y el visor lo lee sin parsear texto.
//
// Formato: "IAS1" | u32 largo del JSON | JSON de metadatos | datos comprimidos (zlib).
// Metadatos: { t: "inicio", tam, poderes, tipos[], variantes[], n (nodos), bytes (sin comprimir), desp{...} }.
// Datos (en este orden, alineados a 4 bytes):
//   esquinas f32 [(tam+1)²] · idNodo i32 [n] · x f32 [n] · z f32 [n] · biomas u8 [tam²] · tipo u8 [n] · variante u8 [n] · estado u8 [n]
import { deflateSync, inflateSync } from "node:zlib";
import type { Mundo } from "./mundo.ts";
import { PODERES } from "./poderes.ts";

export function esquinasDe(m: Mundo): Float32Array {
  const t = m.terreno;
  const n = t.tam + 1;
  const r = new Float32Array(n * n);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    let s = 0, k = 0;
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) {
      const cx = x + dx, cz = z + dz;
      if (cx >= 0 && cz >= 0 && cx < t.tam && cz < t.tam) { s += t.alturas[cz * t.tam + cx]; k++; }
    }
    // Redondeo a 5 cm: comprime mucho mejor y no se nota.
    r[z * n + x] = Math.round((s / Math.max(1, k)) * 20) / 20;
  }
  return r;
}

const al4 = (n: number): number => (n + 3) & ~3;

export function codificarInicio(m: Mundo): Buffer {
  const tam = m.terreno.tam;
  const nodos = [...m.nodos.values()];
  const n = nodos.length;
  const tipos: string[] = [], variantes: string[] = [];
  const idx = (lista: string[], v: string): number => { let i = lista.indexOf(v); if (i < 0) { i = lista.length; lista.push(v); } return i; };
  const esq = esquinasDe(m);
  const desp: Record<string, number> = {};
  let off = 0;
  const reservar = (nombre: string, bytes: number): number => { desp[nombre] = off; off = al4(off + bytes); return desp[nombre]; };
  reservar("esquinas", esq.length * 4);
  reservar("id", n * 4);
  reservar("x", n * 4);
  reservar("z", n * 4);
  reservar("biomas", tam * tam);
  reservar("tipo", n);
  reservar("variante", n);
  reservar("estado", n);
  const datos = new Uint8Array(off);
  const dv = new DataView(datos.buffer);
  new Float32Array(datos.buffer, desp.esquinas, esq.length).set(esq);
  datos.set(m.terreno.biomas, desp.biomas);
  for (let i = 0; i < n; i++) {
    const nd = nodos[i];
    dv.setInt32(desp.id + i * 4, Number(nd.id.slice(1)) | 0, true);
    dv.setFloat32(desp.x + i * 4, nd.x, true);
    dv.setFloat32(desp.z + i * 4, nd.z, true);
    datos[desp.tipo + i] = idx(tipos, nd.tipo);
    datos[desp.variante + i] = idx(variantes, nd.variante);
    datos[desp.estado + i] = nd.nodo.disponible && !nd.quemado ? 1 : 0;
  }
  const comp = deflateSync(datos, { level: 6 });
  const meta = Buffer.from(JSON.stringify({ t: "inicio", tam, poderes: PODERES, tipos, variantes, prefijos: nodos.length ? nodos[0].id[0] : "n", n, bytes: off, desp }), "utf8");
  const cab = Buffer.alloc(8);
  cab.write("IAS1", 0, "ascii");
  cab.writeUInt32LE(meta.length, 4);
  return Buffer.concat([cab, meta, comp]);
}

/** Decodifica el inicio binario (lo usan los tests y herramientas; el visor hace lo mismo en GDScript). */
export function decodificarInicio(buf: Buffer): Record<string, unknown> & { tam: number; nodos: Array<[string, string, string, number, number, number]>; esquinas: Float32Array; biomas: Uint8Array } {
  if (buf.toString("ascii", 0, 4) !== "IAS1") throw new Error("no es un inicio IAS1");
  const largo = buf.readUInt32LE(4);
  const meta = JSON.parse(buf.toString("utf8", 8, 8 + largo)) as Record<string, unknown> & { tam: number; n: number; desp: Record<string, number>; tipos: string[]; variantes: string[] };
  const datos = inflateSync(buf.subarray(8 + largo));
  const ab = datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength);
  const dv = new DataView(ab);
  const n = meta.n, tam = meta.tam;
  const nodos: Array<[string, string, string, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    nodos.push([`n${dv.getInt32(meta.desp.id + i * 4, true)}`, meta.tipos[dv.getUint8(meta.desp.tipo + i)], meta.variantes[dv.getUint8(meta.desp.variante + i)],
      dv.getFloat32(meta.desp.x + i * 4, true), dv.getFloat32(meta.desp.z + i * 4, true), dv.getUint8(meta.desp.estado + i)]);
  }
  return { ...meta, nodos, esquinas: new Float32Array(ab, meta.desp.esquinas, (tam + 1) * (tam + 1)), biomas: new Uint8Array(ab, meta.desp.biomas, tam * tam) };
}
