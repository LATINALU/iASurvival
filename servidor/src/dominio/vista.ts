// Lo que ve el observador: un estado compacto por tick (para animar el mundo 3D) y fichas completas a pedido
// (colono, tribu) para los paneles de la interfaz.

import { calcularAnimo, situacion } from "./animo.ts";
import { ESTRUCTURAS, OBJETOS } from "./catalogo.ts";
import { HABILIDADES } from "./datos/esquema.ts";
import { RASGO_POR_ID } from "./datos/rasgos.ts";
import { TRASFONDO_POR_ID } from "./datos/trasfondos.ts";
import { rasgosDe } from "./colonos.ts";
import { r1, type Mundo } from "./mundo.ts";
import { comidaDe } from "./planificador.ts";
import { opinion } from "./social.ts";
import { estado } from "./tribus.ts";
import { sentado } from "./asientos.ts";
import { objetivoPos } from "./actividades.ts";
import type { Colono } from "./tipos.ts";
import { PODERES } from "./poderes.ts";
import { ERAS, TEC_POR_ID, era } from "./tecnologia.ts";

/** Caminos (para dibujarlos en el visor). */
export function vistaTrazado(m: Mundo): Record<string, unknown> {
  return { t: "trazado", version: m.versionTrazado, caminos: [...m.caminos.values()].map((c) => ({ id: c.id, p: c.puntos.map(([x, z]) => [r1(x), r1(z)]) })) };
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

export function vistaEstado(m: Mundo): Record<string, unknown> {
  return {
    t: "estado",
    tick: m.tick, dia: m.ciclo.dia, hora: m.hora, fase: m.ciclo.fase.nombre, luz: r2(m.ciclo.luz), tiempo: r2(m.ciclo.tiempo),
    estacion: m.estacion, anio: m.anio, mes: m.mes, diaMes: m.diaDelMes, fecha: m.fecha, clima: m.clima.tipo, temperatura: r1(m.temperatura), sequia: m.sequia,
    colonos: m.vivos().map((c) => ({
      id: c.id, n: c.nombre, tr: c.tribu, x: r1(c.x), z: r1(c.z), r: r2(c.rumbo),
      a: c.derribado ? "derribado" : c.dormido ? "dormir" : c.actividad?.tipo ?? null,
      mv: !!c.actividad?.destino && Math.hypot(c.actividad.destino.x - c.x, c.actividad.destino.z - c.z) > c.actividad.destino.alcance,
      an: c.animo, v: Math.round(c.vida), ni: m.esNino(c) ? 1 : 0, cr: c.crisis?.tipo ?? null,
      ap: [c.apariencia.piel, c.apariencia.pelo, c.apariencia.colorPelo, c.apariencia.barba, c.apariencia.complexion, c.apariencia.altura, c.apariencia.sexo],
      eq: [c.equipo.arma, c.equipo.herramienta, c.equipo.ropa, c.equipo.armadura],
      cg: Object.keys(c.carga)[0] ?? null,
      di: c.dijo && m.tick - c.dijo.tick < 40 ? c.dijo.texto : null,
      en: c.enfermedad ? 1 : 0, in: c.inspiracion ? 1 : 0, se: sentado(c) ? 1 : 0, ob: objetivoDe(m, c),
      // Combate: fase del ataque (0 → 1 = golpe), número de combo y reacción reciente (1 esquiva, 2 bloqueo, 3 golpe recibido).
      cb: c.actividad && (c.actividad.tipo === "pelear" || c.actividad.tipo === "cazar") ? [r2(1 - Math.max(0, c.cooldownGolpe) / (OBJETOS.get(c.equipo.arma ?? "")?.arma?.cadencia ?? 1.3)), c.stats.combo ?? 0] : null,
      re: c.stats.reaccion !== undefined && m.tick - c.stats.reaccion < 5 ? c.stats.tipoReaccion : 0,
      // Duerme bajo techo: el visor lo hace entrar en la casa (como en AoE).
      dn: c.dormido && m.refugioEn(c.x, c.z) ? 1 : 0,
    })),
    proyectiles: m.proyectiles.map((p) => [p.id, p.tipo, r2(p.x), r2(p.y), r2(p.z), r2(p.vx), r2(p.vy), r2(p.vz), p.g]),
    animales: [...m.animales.values()].map((b) => ({ id: b.id, e: b.especie, x: r1(b.cuerpo.x), z: r1(b.cuerpo.y), r: r2(Math.atan2(b.cuerpo.vx, b.cuerpo.vy)), s: b.estado, mv: Math.hypot(b.cuerpo.vx, b.cuerpo.vy) > 0.2 ? 1 : 0 })),
    estructuras: [...m.estructuras.values()].map((e) => ({ id: e.id, t: e.tipo, tr: e.tribu, x: r1(e.x), z: r1(e.z), rot: r2(e.rot), p: r2(e.progreso), f: ESTRUCTURAS.get(e.tipo)?.fuego && e.combustible > 0 && e.progreso >= 1 ? 1 : 0, cu: r2(e.cultivo), r: ESTRUCTURAS.get(e.tipo)?.radio ?? 2 })),
    cuerpos: [...m.cuerpos.values()].map((k) => ({ id: k.id, t: k.tipo, n: k.nombre, x: r1(k.x), z: r1(k.z) })),
    fuegos: [...m.incendios.values()].map((f) => [f.x, f.z, r2(f.intensidad)]),
  };
}

export function vistaTribus(m: Mundo): Record<string, unknown> {
  return {
    t: "tribus",
    tribus: [...m.tribus.values()].map((t) => ({
      id: t.id, nombre: t.nombre, color: t.color, simbolo: t.simbolo, cx: r1(t.centro.x), cz: r1(t.centro.z), extinta: t.extinta,
      poblacion: m.miembros(t.id).length, lider: t.lider ? m.colonos.get(t.lider)?.nombre ?? null : null,
      comida: Math.round(comidaDe(t)), almacen: t.almacen,
      relaciones: Object.fromEntries(Object.entries(t.relaciones).map(([k, v]) => [k, { valor: Math.round(v), estado: estado(v) }])),
      construcciones: [...m.estructuras.values()].filter((e) => e.tribu === t.id && e.progreso >= 1).length,
      ciudades: t.stats.ciudades ?? 1, era: era(t), eraNombre: ERAS[era(t)], conoce: t.conoce.map((id) => TEC_POR_ID.get(id)?.nombre ?? id),
      investigando: t.investigando ? TEC_POR_ID.get(t.investigando)!.nombre : null,
      progreso: t.investigando ? Math.round((100 * t.conocimiento) / TEC_POR_ID.get(t.investigando)!.costo) : 0,
      origen: t.origen ? m.tribus.get(t.origen)?.nombre ?? null : null,
    })),
  };
}

export function vistaTerreno(m: Mundo): Record<string, unknown> {
  const t = m.terreno;
  return {
    t: "inicio", tam: t.tam,
    // Alturas en las esquinas de las celdas (promedio de las vecinas): terreno suave y listo para dibujar.
    esquinas: (() => {
      const n = t.tam + 1;
      const r = new Array<number>(n * n);
      for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
        let s = 0, k = 0;
        for (const [dx, dz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const cx = x + dx, cz = z + dz;
          if (cx >= 0 && cz >= 0 && cx < t.tam && cz < t.tam) { s += t.alturas[cz * t.tam + cx]; k++; }
        }
        r[z * n + x] = Math.round((s / Math.max(1, k)) * 10) / 10;
      }
      return r;
    })(),
    biomas: Array.from(t.biomas),
    nodos: [...m.nodos.values()].map((n) => [n.id, n.tipo, n.variante, r1(n.x), r1(n.z), n.nodo.disponible && !n.quemado ? 1 : 0]),
    poderes: PODERES,
  };
}

const NOMBRE_ACTIVIDAD: Record<string, string> = {
  talar: "Talando", minar: "Picando piedra", recolectar: "Recolectando", forrajear: "Buscando bayas", cazar: "Cazando", construir: "Construyendo",
  sembrar: "Sembrando", cosechar: "Cosechando", cocinar: "Cocinando", fabricar: "Fabricando", curar: "Curando", vigilar: "Vigilando",
  avivar: "Avivando el fuego", apagar: "Apagando un incendio", depositar: "Llevando cosas al almacén", comer: "Comiendo", beber: "Bebiendo",
  dormir: "Durmiendo", calentarse: "Calentándose", ocio: "Descansando", charlar: "Charlando", pelear: "Peleando", huir: "Huyendo",
  incursion: "En incursión", comerciar: "Comerciando", jugar: "Jugando", ir: "Caminando", crisis: "En crisis", prender: "Prendiendo fuego",
};

/** Ficha completa de un colono (panel de la interfaz). */
export function fichaColono(m: Mundo, id: string): Record<string, unknown> | null {
  const c = m.colonos.get(id);
  if (!c) return null;
  if (c.vivo) calcularAnimo(m, c);
  const t = m.tribus.get(c.tribu);
  const relaciones = [...m.colonos.values()].filter((o) => o.id !== c.id && o.vivo && (Math.abs(c.memoria.relacion(o.id)) >= 8 || o.id === c.pareja || c.padres.includes(o.id) || o.padres.includes(c.id)))
    .map((o) => ({ id: o.id, nombre: o.nombre, opinion: Math.round(opinion(c, o)), vinculo: o.id === c.pareja ? "pareja" : c.padres.includes(o.id) ? "padre/madre" : o.padres.includes(c.id) ? "hijo/a" : opinion(c, o) > 40 ? "amigo" : opinion(c, o) < -40 ? "rival" : "conocido" }))
    .sort((a, b) => Math.abs(b.opinion) - Math.abs(a.opinion)).slice(0, 12);
  return {
    t: "ficha", id: c.id, nombre: c.nombre, vivo: c.vivo, causaMuerte: c.causaMuerte, tribu: t?.nombre ?? null, tribuId: c.tribu, edad: Math.floor(m.edad(c)),
    sexo: c.apariencia.sexo, lider: t?.lider === c.id,
    actividad: c.crisis ? `En crisis: ${c.crisis.tipo}` : c.derribado ? "Malherido en el suelo" : NOMBRE_ACTIVIDAD[c.dormido ? "dormir" : c.actividad?.tipo ?? ""] ?? "Pensando qué hacer",
    vida: Math.round(c.vida), animo: c.animo, temperatura: r1(c.temperatura), enfermo: !!c.enfermedad,
    necesidades: Object.fromEntries(["hambre", "sed", "energia", "ocio", "social"].map((k) => [k, Math.round(c.necesidades.valor(k))])),
    pensamientos: [
      ...c.pensamientos.map((p) => ({ texto: p.texto, valor: p.valor })),
      ...(c.vivo ? situacion(m, c) : []),
    ].sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)),
    rasgos: rasgosDe(c).map((r) => ({ id: r.id, nombre: r.nombre, descripcion: r.descripcion, categoria: r.categoria, valencia: r.valencia, temporal: c.rasgoTemporal?.id === r.id })),
    personalidad: Object.fromEntries(Object.entries(c.personalidad).map(([k, v]) => [k, r2(v)])),
    trasfondo: [c.trasfondo.infancia, c.trasfondo.adultez].filter(Boolean).map((x) => ({ nombre: TRASFONDO_POR_ID.get(x!)!.nombre, descripcion: TRASFONDO_POR_ID.get(x!)!.descripcion })),
    habilidades: HABILIDADES.map((h) => ({ id: h, nivel: c.habilidades[h].nivel, pasion: c.habilidades[h].pasion })),
    equipo: c.equipo, carga: c.carga,
    pareja: c.pareja ? m.colonos.get(c.pareja)?.nombre ?? null : null,
    relaciones, historia: c.historia.slice(-12).reverse(), stats: c.stats,
  };
}

export function fichaTribu(m: Mundo, id: string): Record<string, unknown> | null {
  const v = (vistaTribus(m).tribus as Array<Record<string, unknown>>).find((t) => t.id === id);
  if (!v) return null;
  return { t: "fichaTribu", ...v, miembros: m.miembros(id).map((c) => ({ id: c.id, nombre: c.nombre, edad: Math.floor(m.edad(c)), animo: c.animo, rasgos: c.rasgos.map((r) => RASGO_POR_ID.get(r)!.nombre) })) };
}

/** A quién apunta en una pelea o cacería (para dibujar flechas y disparos). */
function objetivoDe(m: Mundo, c: Colono): [number, number] | null {
  const a = c.actividad;
  if (!a || (a.tipo !== "pelear" && a.tipo !== "cazar")) return null;
  const p = objetivoPos(m, a.objetivo);
  return p ? [r1(p.x), r1(p.z)] : null;
}
