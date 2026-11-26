// Simulación sin interfaz del mundo de colonias: N días con varias tribus y un informe de balance (población,
// muertes por causa, construcciones, guerras, crisis, parejas, nacimientos y rasgos de los supervivientes).
// Uso: node herramientas/simular.ts --dias 6 --tribus 3 --colonos 5 --semilla 1 [--json] [--sucesos]

import { HZ } from "../src/dominio/mundo.ts";
import { avanzar } from "../src/dominio/simulacion.ts";
import { generarMundo } from "../src/dominio/tribus.ts";
import { comidaDe } from "../src/dominio/planificador.ts";
import { CONFIG_POR_DEFECTO } from "../src/dominio/tipos.ts";
import { RASGO_POR_ID } from "../src/dominio/datos/rasgos.ts";

const arg = (n: string, d: number): number => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};

export interface InformeColonias {
  semilla: number; dias: number; segundosReales: number;
  tribus: Array<{ nombre: string; poblacion: number; fundadores: number; extinta: boolean; construcciones: Record<string, number>; comida: number; madera: number; relaciones: Record<string, number> }>;
  muertes: Record<string, number>;
  sucesos: Record<string, number>;
  nacimientos: number;
}

export function simularColonias(op: { dias: number; tribus: number; colonos: number; semilla: number; registrar?: (texto: string) => void }): InformeColonias {
  const inicio = performance.now();
  const m = generarMundo({ ...CONFIG_POR_DEFECTO, semilla: op.semilla, tribus: op.tribus, colonosPorTribu: op.colonos });
  const sucesos: Record<string, number> = {};
  const muertes: Record<string, number> = {};
  const total = Math.round(op.dias * m.ticksDia);
  for (let t = 0; t < total; t++) {
    avanzar(m);
    for (const e of m.sacarPendientes()) {
      sucesos[e.tipo] = (sucesos[e.tipo] ?? 0) + 1;
      if (e.tipo === "muerte") { const c = String(e.datos?.causa ?? "?"); muertes[m.colonos.has(c) ? "asesinato" : c] = (muertes[m.colonos.has(c) ? "asesinato" : c] ?? 0) + 1; }
      if (op.registrar && e.interes >= 2) op.registrar(`[día ${e.dia} ${e.hora}] ${e.texto}`);
    }
  }
  return {
    semilla: op.semilla, dias: op.dias, segundosReales: Math.round((performance.now() - inicio) / 100) / 10,
    tribus: [...m.tribus.values()].map((t) => {
      const construcciones: Record<string, number> = {};
      for (const e of m.estructuras.values()) if (e.tribu === t.id && e.progreso >= 1) construcciones[e.tipo] = (construcciones[e.tipo] ?? 0) + 1;
      return { nombre: t.nombre, poblacion: m.miembros(t.id).length, fundadores: op.colonos, extinta: t.extinta, construcciones, comida: Math.round(comidaDe(t)), madera: t.almacen.madera ?? 0, relaciones: Object.fromEntries(Object.entries(t.relaciones).map(([k, v]) => [m.tribus.get(k)!.nombre, Math.round(v)])) };
    }),
    muertes, sucesos, nacimientos: sucesos.nacimiento ?? 0,
  };
}

if (process.argv[1]?.endsWith("simular.ts")) {
  const inf = simularColonias({
    dias: arg("dias", 4), tribus: arg("tribus", 3), colonos: arg("colonos", 5), semilla: arg("semilla", 1),
    registrar: process.argv.includes("--sucesos") ? (t) => console.log(t) : undefined,
  });
  if (process.argv.includes("--json")) console.log(JSON.stringify(inf, null, 2));
  else {
    console.log(`iASurvival — semilla ${inf.semilla}, ${inf.dias} días (${inf.segundosReales} s reales)`);
    for (const t of inf.tribus) console.log(`  ${t.nombre}: ${t.poblacion}/${t.fundadores}${t.extinta ? " EXTINTA" : ""} · comida ${t.comida} · madera ${t.madera} · ${JSON.stringify(t.construcciones)} · ${JSON.stringify(t.relaciones)}`);
    console.log(`Muertes: ${JSON.stringify(inf.muertes)}  Nacimientos: ${inf.nacimientos}`);
    console.log(`Sucesos: ${JSON.stringify(inf.sucesos)}`);
  }
  void HZ;
  void RASGO_POR_ID;
}
