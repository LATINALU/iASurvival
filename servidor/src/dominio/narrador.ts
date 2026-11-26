// Narrador: cada cierto tiempo tira un suceso según la estación y el estado de las tribus, con enfriamiento para no
// repetir: olas de frío y de calor, sequía, manadas, osos, viajeros, plagas, cosechas abundantes, estampidas y
// meteoritos. Sube la presión cuando todo va bien y la baja cuando las tribus sufren.

import { cambiarClima } from "./clima.ts";
import { crearAnimal } from "./fauna.ts";
import type { Mundo } from "./mundo.ts";
import { crearNodo, llegaViajero } from "./tribus.ts";
import { meteorito, plaga } from "./poderes.ts";

interface Suceso {
  readonly id: string;
  readonly peso: (m: Mundo) => number;
  readonly enfriamientoDias: number;
  readonly hacer: (m: Mundo) => void;
}

const ultimo = new WeakMap<Mundo, Record<string, number>>();

const SUCESOS: readonly Suceso[] = [
  {
    id: "ola_frio", enfriamientoDias: 3, peso: (m) => (m.estacion === "invierno" ? 3 : m.estacion === "otoño" ? 1 : 0),
    hacer: (m) => { m.clima.ola = -8; m.clima.olaHasta = m.tick + Math.round(m.ticksDia * 1.2); m.emitir("ola_frio", "Llega una ola de frío. El aliento se congela.", { interes: 3 }); },
  },
  {
    id: "ola_calor", enfriamientoDias: 3, peso: (m) => (m.estacion === "verano" ? 2 : 0),
    hacer: (m) => { m.clima.ola = 12; m.clima.olaHasta = m.tick + Math.round(m.ticksDia); m.emitir("ola_calor", "Una ola de calor aplasta el valle.", { interes: 2 }); },
  },
  {
    id: "sequia", enfriamientoDias: 5, peso: (m) => (m.estacion === "verano" ? 1.5 : 0.2),
    hacer: (m) => { m.clima.sequiaHasta = m.tick + Math.round(m.ticksDia * 2); cambiarClima(m, "despejado", 0.5, false); m.emitir("sequia", "Comienza una sequía: los cultivos sufren y el fuego se propaga fácil.", { interes: 3 }); },
  },
  {
    id: "manada", enfriamientoDias: 1.5, peso: (m) => 1.2 + (m.estacion === "invierno" ? 1 : 0),
    hacer: (m) => {
      const t = [...m.tribus.values()].filter((x) => !x.extinta);
      const obj = t[Math.floor(m.azar.siguiente() * t.length)];
      if (!obj) return;
      const p = m.lugarLibre({ cerca: obj.centro, radio: 40, evitar: [obj.centro], minDist: 25 });
      const manada = Number(m.nuevoId("m").slice(1));
      for (let i = 0; i < 4 + Math.floor(m.azar.siguiente() * 3); i++) crearAnimal(m, "lobo", p.x + m.azar.rango(-2, 2), p.z + m.azar.rango(-2, 2), manada);
      m.emitir("manada", `Una manada hambrienta merodea cerca de ${obj.nombre}.`, { x: p.x, z: p.z, interes: 3, tribu: obj.id });
    },
  },
  {
    id: "oso", enfriamientoDias: 2, peso: () => 0.6,
    hacer: (m) => { const p = m.lugarLibre({ biomas: ["denso", "bosque"] }); crearAnimal(m, "oso", p.x, p.z); m.emitir("oso", "Un oso enorme baja de las montañas.", { x: p.x, z: p.z, interes: 2 }); },
  },
  {
    // Con los siglos aparecen vetas nuevas (las partidas duran cientos de años: nada se acaba del todo).
    id: "veta", enfriamientoDias: 6, peso: () => 0.5,
    hacer: (m) => {
      const tipos = ["roca", "roca", "carbon", "cobre", "hierro", "azufre", "oro"];
      const tipo = tipos[Math.floor(m.azar.siguiente() * tipos.length)];
      for (let k = 0; k < 60; k++) {
        const x = m.azar.rango(20, m.config.tam - 20), z = m.azar.rango(20, m.config.tam - 20);
        let ok = true;
        for (let dz = -4; dz <= 4 && ok; dz++) for (let dx = -4; dx <= 4 && ok; dx++) if (!m.pisable(x + dx, z + dz)) ok = false;
        if (!ok || m.yacimientosCerca(x, z, 35).length || [...m.estructuras.values()].some((e) => Math.hypot(e.x - x, e.z - z) < 20)) continue;
        for (const n of m.nodosCerca(x, z, 4)) m.nodos.delete(n.id);
        crearNodo(m, tipo, tipo, x, z);
        m.hornearYacimientos();
        const nombres: Record<string, string> = { roca: "una cantera", carbon: "una veta de carbón", cobre: "una veta de cobre", hierro: "una veta de hierro", azufre: "un yacimiento de azufre", oro: "una veta de oro" };
        m.emitir("veta", `Un derrumbe deja al descubierto ${nombres[tipo]}.`, { x, z, interes: 2 });
        return;
      }
    },
  },
  { id: "viajero", enfriamientoDias: 1.2, peso: () => 1.5, hacer: (m) => llegaViajero(m) },
  {
    id: "plaga", enfriamientoDias: 6, peso: (m) => (m.vivos().length > 12 ? 0.7 : 0.15),
    hacer: (m) => { const v = m.vivos(); const c = v[Math.floor(m.azar.siguiente() * v.length)]; if (c) plaga(m, c.x, c.z, false); },
  },
  {
    id: "cosecha", enfriamientoDias: 3, peso: (m) => (m.estacion === "otoño" ? 1.5 : m.estacion === "verano" ? 0.6 : 0),
    hacer: (m) => {
      for (const e of m.estructuras.values()) if (e.tipo === "huerto" && e.progreso >= 1 && e.cultivo > 0) e.cultivo = 1;
      for (const n of m.nodos.values()) if (n.tipo === "arbusto" && !n.quemado) { n.nodo.restantes = n.nodo.def.golpes + 2; m.nodosCambiados.add(n.id); }
      m.emitir("cosecha_abundante", "Llega una cosecha abundante: los arbustos rebosan de bayas.", { interes: 2 });
    },
  },
  {
    id: "estampida", enfriamientoDias: 2, peso: () => 0.6,
    hacer: (m) => { const p = m.lugarLibre({ biomas: ["pradera"] }); for (let i = 0; i < 8; i++) crearAnimal(m, "ciervo", p.x + m.azar.rango(-4, 4), p.z + m.azar.rango(-4, 4)); m.emitir("ciervos", "Una manada de ciervos cruza la pradera.", { x: p.x, z: p.z, interes: 1 }); },
  },
  {
    id: "meteorito", enfriamientoDias: 10, peso: () => 0.12,
    hacer: (m) => { const p = m.lugarLibre(); meteorito(m, p.x, p.z, false); },
  },
];

/** Sistema del narrador: cada ~0.12 días tira un suceso posible. */
export function sistemaNarrador(m: Mundo, _dt: number): void {
  const cada = Math.round(m.ticksDia * 0.12);
  if (m.tick % cada !== 0 || m.tick < m.ticksDia * 0.4) return;
  const u = ultimo.get(m) ?? {};
  ultimo.set(m, u);
  // Presión: si las tribus sufren (ánimo medio bajo), el narrador afloja.
  const vivos = m.vivos();
  const animo = vivos.length ? vivos.reduce((s, c) => s + c.animo, 0) / vivos.length : 50;
  if (!m.azar.prob(Math.max(0.15, Math.min(0.65, (animo - 25) / 60)))) return;
  const posibles = SUCESOS.filter((s) => s.peso(m) > 0 && m.tick - (u[s.id] ?? -Infinity) > s.enfriamientoDias * m.ticksDia);
  const total = posibles.reduce((s, x) => s + x.peso(m), 0);
  let r = m.azar.siguiente() * total;
  for (const s of posibles) {
    r -= s.peso(m);
    if (r <= 0) {
      u[s.id] = m.tick;
      s.hacer(m);
      return;
    }
  }
}

