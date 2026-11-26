// Poderes de dios (el observador): cambian el rumbo de la historia sin controlar a nadie. Se aplican en un punto
// del mapa (x, z) o sobre un colono. Cada uso queda en la bitácora como intervención divina, y los colonos
// supersticiosos o devotos lo viven con más intensidad.

import { exito, fallo, type Resultado } from "txnucleo";
import { iniciarCrisis, recordar } from "./animo.ts";
import { caeRayo, cambiarClima, prender } from "./clima.ts";
import { crearColono, daniar, resucitar } from "./colonos.ts";
import { crearAnimal } from "./fauna.ts";
import { dist, type Mundo } from "./mundo.ts";
import { RASGOS } from "./datos/rasgos.ts";
import { ESTRUCTURAS } from "./catalogo.ts";
import { caminable } from "./terreno.ts";
import type { Colono } from "./tipos.ts";

export interface DefPoder {
  readonly id: string;
  readonly nombre: string;
  readonly descripcion: string;
  /** "punto" (clic en el mapa), "colono" (clic sobre alguien), "mundo" (sin objetivo) o "tribus" (dos tribus). */
  readonly objetivo: "punto" | "colono" | "mundo" | "cuerpo";
  readonly radio?: number;
}

export const PODERES: readonly DefPoder[] = [
  { id: "rayo", nombre: "Rayo", descripcion: "Un rayo cae donde señales: hiere y prende fuego.", objetivo: "punto", radio: 2 },
  { id: "lluvia", nombre: "Lluvia", descripcion: "Lluvia durante medio día: apaga incendios y riega cultivos.", objetivo: "mundo" },
  { id: "tormenta", nombre: "Tormenta", descripcion: "Una tormenta eléctrica con rayos al azar.", objetivo: "mundo" },
  { id: "sequia", nombre: "Sequía", descripcion: "Dos días sin lluvia: cultivos lentos y fuego fácil.", objetivo: "mundo" },
  { id: "frio", nombre: "Ola de frío", descripcion: "Un día de frío cruel.", objetivo: "mundo" },
  { id: "calor", nombre: "Ola de calor", descripcion: "Un día de calor sofocante.", objetivo: "mundo" },
  { id: "incendio", nombre: "Incendio", descripcion: "Prende fuego en el lugar señalado.", objetivo: "punto", radio: 2 },
  { id: "meteorito", nombre: "Meteorito", descripcion: "Una roca del cielo arrasa la zona y deja piedra.", objetivo: "punto", radio: 6 },
  { id: "terremoto", nombre: "Terremoto", descripcion: "Sacude la zona y derrumba construcciones.", objetivo: "punto", radio: 16 },
  { id: "lobos", nombre: "Manada de lobos", descripcion: "Invoca una manada de lobos.", objetivo: "punto", radio: 3 },
  { id: "oso", nombre: "Oso", descripcion: "Invoca un oso.", objetivo: "punto", radio: 2 },
  { id: "ciervos", nombre: "Ciervos", descripcion: "Invoca una manada de ciervos (comida).", objetivo: "punto", radio: 4 },
  { id: "bendecir", nombre: "Bendecir", descripcion: "Alegría (+20 de ánimo un día) a quienes estén en la zona.", objetivo: "punto", radio: 7 },
  { id: "maldecir", nombre: "Maldecir", descripcion: "Pesadumbre (−20 de ánimo un día) en la zona.", objetivo: "punto", radio: 7 },
  { id: "curar", nombre: "Curar", descripcion: "Sana heridas y fiebre en la zona.", objetivo: "punto", radio: 7 },
  { id: "plaga", nombre: "Plaga", descripcion: "Una fiebre contagiosa en la zona.", objetivo: "punto", radio: 6 },
  { id: "inspirar", nombre: "Inspirar", descripcion: "Un colono recibe un rasgo bueno durante dos días y trabaja el doble.", objetivo: "colono" },
  { id: "locura", nombre: "Locura", descripcion: "Un colono pierde la cabeza (crisis inmediata).", objetivo: "colono" },
  { id: "resucitar", nombre: "Resucitar", descripcion: "Devuelve la vida a un colono muerto (clic sobre su cuerpo).", objetivo: "cuerpo" },
  { id: "colono", nombre: "Crear colono", descripcion: "Aparece un colono nuevo que se une a la tribu más cercana.", objetivo: "punto" },
  { id: "regalo", nombre: "Regalo", descripcion: "Una lluvia de recursos sobre el almacén de la tribu más cercana.", objetivo: "punto" },
  { id: "discordia", nombre: "Discordia", descripcion: "La tribu más cercana y su vecina se odian (guerra).", objetivo: "punto" },
  { id: "paz", nombre: "Paz", descripcion: "Todas las tribus olvidan sus rencores.", objetivo: "mundo" },
];

const enZona = (m: Mundo, x: number, z: number, r: number): Colono[] => m.vivos().filter((c) => Math.hypot(c.x - x, c.z - z) <= r);

function divino(m: Mundo, afectados: readonly Colono[], valor: number, texto: string): void {
  for (const c of m.vivos()) recordar(m, c, "intervencion", afectados.includes(c) ? valor : valor * 0.15, texto, afectados.includes(c) ? 1 : 0.3);
}

export function meteorito(m: Mundo, x: number, z: number, divina = true): void {
  for (const c of enZona(m, x, z, 6)) daniar(m, c, 90 * (1 - Math.hypot(c.x - x, c.z - z) / 7), "meteorito");
  for (const n of m.nodosCerca(x, z, 5)) { const id = n.id; n.quemado = true; n.nodo.restantes = 0; n.espera = n.nodo.def.reaparicion * 2; m.nodosCambiados.add(id); }
  for (const [id, e] of [...m.estructuras]) if (Math.hypot(e.x - x, e.z - z) < 5) m.quitarEstructura(id);
  for (const b of [...m.animales.values()]) if (Math.hypot(b.cuerpo.x - x, b.cuerpo.y - z) < 6) m.animales.delete(b.id);
  for (let i = 0; i < 6; i++) prender(m, x + m.azar.rango(-4, 4), z + m.azar.rango(-4, 4), 1);
  const k = { id: m.nuevoId("k"), tipo: "bolsa" as const, nombre: "rocas del meteorito", x, z, contenido: { piedra: 60 }, expira: m.tick + m.ticksDia * 6 };
  m.cuerpos.set(k.id, k);
  m.emitir("meteorito", divina ? "¡Los dioses lanzan un meteorito!" : "¡Un meteorito cae del cielo!", { x, z, interes: 3 });
}

export function plaga(m: Mundo, x: number, z: number, divina = true): void {
  const v = enZona(m, x, z, 6);
  for (const c of v) c.enfermedad = { severidad: 0.25 + m.azar.siguiente() * 0.2, inmunidad: 0 };
  if (v.length) m.emitir("plaga", `${divina ? "Una maldición" : "Una fiebre"} se extiende: ${v.map((c) => c.nombre).join(", ")} enferman.`, { x, z, actores: v.map((c) => c.id), interes: 3 });
}

function tribuMasCercana(m: Mundo, x: number, z: number) {
  return [...m.tribus.values()].filter((t) => !t.extinta).sort((a, b) => Math.hypot(a.centro.x - x, a.centro.z - z) - Math.hypot(b.centro.x - x, b.centro.z - z))[0];
}

/** Usa un poder. */
export function usarPoder(m: Mundo, id: string, op: { x?: number; z?: number; objetivo?: string }): Resultado<string, string> {
  const def = PODERES.find((p) => p.id === id);
  if (!def) return fallo(`poder desconocido "${id}"`);
  const x = Number(op.x), z = Number(op.z);
  if ((def.objetivo === "punto") && (!Number.isFinite(x) || !Number.isFinite(z))) return fallo("este poder necesita un punto del mapa");
  const t = Number.isFinite(x) ? tribuMasCercana(m, x, z) : undefined;
  switch (id) {
    case "rayo": caeRayo(m, x, z, true); divino(m, enZona(m, x, z, 10), -4, "Un rayo de los dioses cayó cerca"); break;
    case "lluvia": cambiarClima(m, "lluvia", 0.5); m.clima.sequiaHasta = 0; for (const c of m.vivos()) recordar(m, c, "lluvia_divina", 3, "Llegó la lluvia", 0.5); break;
    case "tormenta": cambiarClima(m, "tormenta", 0.3); break;
    case "sequia": m.clima.sequiaHasta = m.tick + m.ticksDia * 2; cambiarClima(m, "despejado", 0.6, false); m.emitir("sequia", "Los dioses secan el cielo: comienza una sequía.", { interes: 3 }); break;
    case "frio": m.clima.ola = -14; m.clima.olaHasta = m.tick + m.ticksDia; m.emitir("ola_frio", "Los dioses traen un frío cruel.", { interes: 3 }); break;
    case "calor": m.clima.ola = 13; m.clima.olaHasta = m.tick + m.ticksDia; m.emitir("ola_calor", "Los dioses traen un calor sofocante.", { interes: 3 }); break;
    case "incendio": for (let i = 0; i < 4; i++) prender(m, x + m.azar.rango(-1, 1), z + m.azar.rango(-1, 1), 1); m.emitir("incendio", "Las llamas brotan de la nada.", { x, z, interes: 3 }); break;
    case "meteorito": meteorito(m, x, z); divino(m, enZona(m, x, z, 25), -8, "Vi caer un meteorito"); break;
    case "terremoto": {
      let n = 0;
      for (const [eid, e] of [...m.estructuras]) {
        if (Math.hypot(e.x - x, e.z - z) > 16) continue;
        e.progreso = Math.max(0, e.progreso - 0.6);
        e.vida -= ESTRUCTURAS.get(e.tipo)!.vida * 0.5;
        n++;
        if (e.vida <= 0 || e.progreso <= 0) m.quitarEstructura(eid);
      }
      for (const c of enZona(m, x, z, 16)) daniar(m, c, 8, "divino");
      divino(m, enZona(m, x, z, 25), -10, "La tierra tembló");
      m.emitir("terremoto", `¡La tierra tiembla! ${n} construcciones dañadas.`, { x, z, interes: 3 });
      break;
    }
    case "lobos": { const manada = Number(m.nuevoId("m").slice(1)); for (let i = 0; i < 5; i++) crearAnimal(m, "lobo", x + m.azar.rango(-2, 2), z + m.azar.rango(-2, 2), manada); m.emitir("manada", "Los dioses sueltan una manada de lobos.", { x, z, interes: 3 }); break; }
    case "oso": crearAnimal(m, "oso", x, z); m.emitir("oso", "Un oso aparece de la nada.", { x, z, interes: 2 }); break;
    case "ciervos": for (let i = 0; i < 6; i++) crearAnimal(m, "ciervo", x + m.azar.rango(-3, 3), z + m.azar.rango(-3, 3)); m.emitir("ciervos", "Una manada de ciervos aparece.", { x, z, interes: 1 }); break;
    case "bendecir": { const v = enZona(m, x, z, 7); for (const c of v) recordar(m, c, "bendicion", 20, "Me siento bendecido", 1); m.emitir("bendicion", `Una luz bendice a ${v.map((c) => c.nombre).join(", ") || "nadie"}.`, { x, z, actores: v.map((c) => c.id), interes: 2 }); break; }
    case "maldecir": { const v = enZona(m, x, z, 7); for (const c of v) recordar(m, c, "maldicion", -20, "Una sombra pesa sobre mí", 1); m.emitir("maldicion", `Una sombra maldice a ${v.map((c) => c.nombre).join(", ") || "nadie"}.`, { x, z, actores: v.map((c) => c.id), interes: 2 }); break; }
    case "curar": { const v = enZona(m, x, z, 7); for (const c of v) { c.vida = 100; c.enfermedad = null; c.derribado = false; c.crisis = null; } m.emitir("curacion", `Una curación milagrosa: ${v.map((c) => c.nombre).join(", ") || "nadie"}.`, { x, z, actores: v.map((c) => c.id), interes: 2 }); divino(m, v, 8, "Fui curado por los dioses"); break; }
    case "plaga": plaga(m, x, z); break;
    case "inspirar": {
      const c = m.colonos.get(op.objetivo ?? "");
      if (!c || !c.vivo) return fallo("elige un colono vivo");
      const buenos = RASGOS.filter((r) => r.valencia === 1 && !c.rasgos.includes(r.id));
      const r = buenos[Math.floor(m.azar.siguiente() * buenos.length)];
      c.rasgoTemporal = { id: r.id, hasta: m.tick + m.ticksDia * 2 };
      c.inspiracion = { hasta: m.tick + m.ticksDia };
      recordar(m, c, "bendicion", 12, "Una voz divina me inspira", 2);
      m.emitir("inspirar", `Los dioses inspiran a ${c.nombre}: ahora es ${r.nombre.toLowerCase()}.`, { x: c.x, z: c.z, actores: [c.id], interes: 3, tribu: c.tribu });
      break;
    }
    case "locura": {
      const c = m.colonos.get(op.objetivo ?? "");
      if (!c || !c.vivo) return fallo("elige un colono vivo");
      iniciarCrisis(m, c);
      break;
    }
    case "resucitar": {
      const k = [...m.cuerpos.values()].find((x) => x.id === op.objetivo || (x.tipo === "colono" && Number.isFinite(Number(op.x)) && Math.hypot(x.x - Number(op.x), x.z - Number(op.z)) < 3));
      const c = k?.colono ? m.colonos.get(k.colono) : undefined;
      if (!k || !c) return fallo("no hay un cuerpo de colono ahí");
      m.cuerpos.delete(k.id);
      resucitar(m, c, k.x, k.z);
      for (const o of m.vivos()) if (dist(o, c) < 20) recordar(m, o, "intervencion", 6, `${c.nombre} volvió de entre los muertos`, 2);
      m.emitir("resurreccion", `¡${c.nombre} vuelve de entre los muertos!`, { x: c.x, z: c.z, actores: [c.id], interes: 3, tribu: c.tribu });
      break;
    }
    case "colono": {
      if (!t) return fallo("no hay tribus");
      if (!caminable(m.terreno, Math.floor(x), Math.floor(z))) return fallo("ahí no se puede aparecer");
      const c = crearColono(m, { tribu: t.id, x, z });
      m.emitir("aparicion", `${c.nombre} aparece de la nada y se une a ${t.nombre}.`, { x, z, actores: [c.id], interes: 3, tribu: t.id });
      break;
    }
    case "regalo": {
      if (!t) return fallo("no hay tribus");
      for (const [o, n] of Object.entries({ madera: 40, piedra: 25, bayas: 30, carne_asada: 10, fibra: 15 })) m.meter(t, o, n);
      for (const c of m.miembros(t.id)) recordar(m, c, "regalo", 8, "Los dioses nos regalaron provisiones", 1);
      m.emitir("regalo", `Una lluvia de provisiones cae sobre ${t.nombre}.`, { x: t.centro.x, z: t.centro.z, interes: 2, tribu: t.id });
      break;
    }
    case "discordia": {
      if (!t) return fallo("no hay tribus");
      const otra = [...m.tribus.values()].filter((o) => o !== t && !o.extinta).sort((a, b) => dist(a.centro, t.centro) - dist(b.centro, t.centro))[0];
      if (!otra) return fallo("no hay otra tribu con quien pelear");
      t.relaciones[otra.id] = -85;
      otra.relaciones[t.id] = -85;
      m.emitir("discordia", `Los dioses siembran el odio: ${t.nombre} y ${otra.nombre} entran en guerra.`, { x: t.centro.x, z: t.centro.z, interes: 3, tribu: t.id, datos: { de: t.id, a: otra.id, estado: "guerra" } });
      break;
    }
    case "paz": {
      for (const a of m.tribus.values()) for (const k of Object.keys(a.relaciones)) a.relaciones[k] = Math.max(a.relaciones[k], 20);
      for (const c of m.vivos()) recordar(m, c, "intervencion", 5, "Los dioses traen la paz", 1);
      m.emitir("paz", "Una calma divina cae sobre el valle: las tribus olvidan sus rencores.", { interes: 3 });
      break;
    }
  }
  m.emitir("poder", `Intervención divina: ${def.nombre}.`, { x: Number.isFinite(x) ? x : undefined, z: Number.isFinite(z) ? z : undefined, interes: 0, datos: { poder: id } });
  return exito(def.nombre);
}
