// Foto del mundo en JSON plano (guardado periódico) y reconstrucción. Las piezas de TxNucleo con estado en Maps
// o campos privados (Necesidades, MemoriaNarrativa, NodoRecoleccion) se pasan a DTOs.

import { narrativa, supervivencia } from "txnucleo";
import { NODOS } from "./catalogo.ts";
import { definirNecesidades } from "./colonos.ts";
import { HZ, Mundo } from "./mundo.ts";
import type { Animal, Camino, Clima, Colono, ConfigMundo, Cuerpo, Estructura, EventoMundo, Incendio, Tarea, Tribu } from "./tipos.ts";

export const VERSION_GUARDADO = 4;

type ColonoDTO = Omit<Colono, "necesidades" | "memoria"> & { necesidades: Array<[string, number]>; memoria: ReturnType<narrativa.MemoriaNarrativa["exportar"]> };

export interface FotoMundo {
  readonly config: ConfigMundo;
  readonly tick: number;
  readonly azar: number;
  readonly ciclo: { tiempo: number; dia: number };
  readonly clima: Clima;
  readonly contadores: Record<string, number>;
  readonly seqBitacora: number;
  readonly bitacora: EventoMundo[];
  readonly nodos: Array<[string, string, string, number, number, number, number, boolean]>;
  readonly colonos: ColonoDTO[];
  readonly tribus: Tribu[];
  readonly animales: Animal[];
  readonly estructuras: Estructura[];
  readonly cuerpos: Cuerpo[];
  readonly tareas: Tarea[];
  readonly incendios: Array<[string, Incendio]>;
  readonly caminos?: Camino[];
}

export function exportarMundo(m: Mundo): FotoMundo {
  return {
    config: m.config, tick: m.tick, azar: m.azar.estado, ciclo: { tiempo: m.ciclo.tiempo, dia: m.ciclo.dia }, clima: m.clima,
    contadores: { ...m.contadores }, seqBitacora: m.seqBitacora, bitacora: m.bitacora.slice(-600),
    nodos: [...m.nodos.values()].map((n) => [n.id, n.tipo, n.variante, n.x, n.z, n.nodo.restantes, n.espera, n.quemado]),
    colonos: [...m.colonos.values()].map((c) => ({ ...c, necesidades: [...c.necesidades.valores], memoria: c.memoria.exportar() })),
    tribus: [...m.tribus.values()], animales: [...m.animales.values()], estructuras: [...m.estructuras.values()],
    cuerpos: [...m.cuerpos.values()], tareas: [...m.tareas.values()], incendios: [...m.incendios], caminos: [...m.caminos.values()],
  };
}

export function importarMundo(f: FotoMundo): Mundo {
  const m = new Mundo(f.config);
  m.tick = f.tick;
  m.azar.estado = f.azar;
  m.ciclo.tiempo = f.ciclo.tiempo;
  m.ciclo.dia = f.ciclo.dia;
  m.clima = { ...f.clima };
  Object.assign(m.contadores, f.contadores);
  m.seqBitacora = f.seqBitacora;
  m.bitacora.push(...f.bitacora);
  for (const [id, tipo, variante, x, z, restantes, espera, quemado] of f.nodos) {
    const nodo = new supervivencia.NodoRecoleccion(NODOS.get(tipo)!.def);
    nodo.restantes = restantes;
    m.nodos.set(id, { id, tipo, variante, x, z, nodo, espera, quemado });
  }
  const defs = definirNecesidades(f.config.segundosPorDia);
  for (const d of f.colonos) {
    const necesidades = new supervivencia.Necesidades(defs);
    for (const [k, v] of d.necesidades) necesidades.valores.set(k, v);
    const memoria = new narrativa.MemoriaNarrativa(80);
    memoria.importar(d.memoria);
    const c = { ...d, necesidades, memoria } as Colono;
    m.colonos.set(c.id, c);
  }
  for (const t of f.tribus) m.tribus.set(t.id, { ...t, nucleo: t.nucleo ?? t.nombre.split(" ").slice(1).join(" "), rango: t.rango ?? 0, edad: t.edad ?? 1, ultimaIncursion: t.ultimaIncursion ?? -1e9, ultimaCaravana: t.ultimaCaravana ?? -1e9 });
  for (const b of f.animales) m.animales.set(b.id, b);
  for (const e of f.estructuras) m.estructuras.set(e.id, e);
  for (const k of f.cuerpos) m.cuerpos.set(k.id, k);
  for (const t of f.tareas) m.tareas.set(t.id, t);
  for (const [k, v] of f.incendios) m.incendios.set(k, v);
  for (const c of f.caminos ?? []) m.agregarCamino(c.id, c.puntos, c.tribu);
  m.hornearYacimientos();
  m.nodosNuevos.clear();
  for (const n of m.nodos.values()) if (!n.nodo.disponible || n.quemado) m.agotados.add(n.id);
  m.recalcularTrazado();
  return m;
}

export function esFoto(d: unknown): d is FotoMundo {
  const f = d as FotoMundo;
  return !!f && typeof f.tick === "number" && Array.isArray(f.colonos) && Array.isArray(f.tribus) && !!f.config;
}

export const TICKS_ENTRE_GUARDADOS = 60 * HZ;
