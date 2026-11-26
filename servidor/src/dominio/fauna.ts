// Fauna: presas que huyen (conejo, ciervo), animales que se defienden si los molestan (jabalí, oso) y lobos que
// cazan en manada, sobre todo de noche. Se mueven con los comportamientos de dirección de TxNucleo
// (`ia.direccion`: huir, buscar, deambular, bandada, integrar). Le temen al fuego y no entran a las casas.

import { ia } from "txnucleo";
import { recordar } from "./animo.ts";
import { ESPECIES } from "./catalogo.ts";
import { daniar } from "./colonos.ts";
import { alarma } from "./actividades.ts";
import { HZ, type Mundo } from "./mundo.ts";
import { biomaEn, caminable } from "./terreno.ts";
import type { Animal, Colono, Cuerpo } from "./tipos.ts";

const d2 = (ax: number, az: number, bx: number, bz: number): number => Math.hypot(ax - bx, az - bz);

export function crearAnimal(m: Mundo, especie: string, x: number, z: number, manada = 0): Animal {
  const esp = ESPECIES.get(especie)!;
  const b: Animal = {
    id: m.nuevoId("b"), especie,
    cuerpo: { x, y: z, vx: 0, vy: 0, velMax: esp.velocidad, fuerzaMax: 12 },
    vida: esp.vida, estado: "deambular", objetivo: null, manada,
    deambular: { angulo: m.azar.rango(0, Math.PI * 2) }, cooldown: 0, panico: 0, ultimoAtacante: null,
  };
  m.animales.set(b.id, b);
  return b;
}

export function matarAnimal(m: Mundo, b: Animal): void {
  const esp = ESPECIES.get(b.especie)!;
  const c: Cuerpo = { id: m.nuevoId("k"), tipo: "animal", nombre: b.especie, x: b.cuerpo.x, z: b.cuerpo.y, contenido: { ...esp.botin }, expira: m.tick + Math.round(m.ticksDia * 0.6) };
  m.cuerpos.set(c.id, c);
  m.animales.delete(b.id);
}

export function sistemaFauna(m: Mundo, dt: number): void {
  if (m.tick % (HZ * 5) === 3) poblacion(m);
  const colonos = m.vivos();
  // Nivel de detalle: lejos de toda la gente (más de ~100 m) un animal se simula 1 de cada 8 ticks (con dt ×8).
  const T = 64;
  const ocupadas = new Set<number>();
  for (const c of colonos) ocupadas.add(Math.floor(c.z / T) * 4096 + Math.floor(c.x / T));
  const cerca = (x: number, z: number): boolean => {
    const cx = Math.floor(x / T), cz = Math.floor(z / T);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (ocupadas.has((cz + dz) * 4096 + cx + dx)) return true;
    return false;
  };
  let k = 0;
  for (const b of [...m.animales.values()]) {
    k++;
    if (!m.animales.has(b.id)) continue;
    let paso = dt;
    if (!cerca(b.cuerpo.x, b.cuerpo.y)) {
      if ((m.tick + k) % 8 !== 0) continue;
      paso = dt * 8;
    }
    const esp = ESPECIES.get(b.especie)!;
    if (b.cooldown > 0) b.cooldown -= paso;
    const zona = esp.conducta === "presa" ? colonos : m.colonosCerca(b.cuerpo.x, b.cuerpo.y, 70);
    if (esp.conducta === "presa") presa(m, b, zona, paso);
    else if (esp.conducta === "depredador") lobo(m, b, zona, paso);
    else defensivo(m, b, zona, paso);
  }
}

function mover(m: Mundo, b: Animal, fuerzas: ia.Fuerza[], dt: number): void {
  const c = b.cuerpo;
  const px = c.x, py = c.y;
  ia.integrar(c, fuerzas, dt);
  if (!caminable(m.terreno, Math.floor(c.x), Math.floor(c.y)) || m.bloqueaAnimal(c.x, c.y)) {
    c.x = px;
    c.y = py;
    c.vx = -c.vx * 0.5;
    c.vy = -c.vy * 0.5;
    b.deambular.angulo += Math.PI * (0.5 + m.azar.siguiente());
  }
}

function presa(m: Mundo, b: Animal, colonos: Colono[], dt: number): void {
  const esp = ESPECIES.get(b.especie)!;
  const c = b.cuerpo;
  let amenaza: { x: number; z: number } | null = null, md = Infinity;
  for (const o of m.colonosCerca(c.x, c.y, esp.vision)) {
    if (o.dormido) continue;
    const d = d2(o.x, o.z, c.x, c.y);
    // Los amigos de los animales casi no los asustan.
    const vision = esp.vision * (o.rasgos.includes("amante_animales") ? 0.3 : 0.65);
    if (d < vision && d < md) { md = d; amenaza = o; }
  }
  for (const o of m.animalesCerca(c.x, c.y, esp.vision)) {
    if (ESPECIES.get(o.especie)!.conducta !== "depredador") continue;
    const d = d2(o.cuerpo.x, o.cuerpo.y, c.x, c.y);
    if (d < esp.vision && d < md) { md = d; amenaza = { x: o.cuerpo.x, z: o.cuerpo.y }; }
  }
  if (amenaza) {
    b.estado = "huir";
    b.panico = 3;
    c.velMax = esp.velocidadHuida;
    mover(m, b, [ia.huir(c, amenaza.x, amenaza.z)], dt);
    return;
  }
  if (b.panico > 0) { b.panico -= dt; c.velMax = esp.velocidadHuida; }
  else { b.estado = "deambular"; c.velMax = esp.velocidad; }
  mover(m, b, [ia.deambular(c, b.deambular, m.azar.siguiente(), 3, 1.5, 0.4)], dt);
}

/** ¿Algo asusta a un depredador (fuego cerca)? */
function miedo(m: Mundo, x: number, z: number): { x: number; z: number } | null {
  return m.fuegoCerca(x, z, 7);
}

function atacar(m: Mundo, b: Animal, objetivo: string): void {
  const esp = ESPECIES.get(b.especie)!;
  if (b.cooldown > 0) return;
  b.cooldown = esp.cadencia;
  const danio = esp.danio * m.azar.rango(0.8, 1.2);
  const v = m.colonos.get(objetivo);
  if (v && v.vivo) {
    if (v.ultimoDanio !== b.especie || v.vida > 85) m.emitir("ataque_animal", `¡Un ${b.especie} ataca a ${v.nombre}!`, { x: v.x, z: v.z, actores: [v.id], interes: b.especie === "oso" ? 3 : 2, tribu: v.tribu });
    recordar(m, v, "pelea", -3, `Me atacó un ${b.especie}`, 0.5);
    daniar(m, v, danio, b.especie);
    if (v.vivo) alarma(m, v, b.id);
    if (!v.vivo || v.derribado) b.objetivo = null;
    return;
  }
  const p = m.animales.get(objetivo);
  if (p) {
    p.vida -= danio * 1.5;
    if (p.vida <= 0) {
      const x = p.cuerpo.x, z = p.cuerpo.y;
      matarAnimal(m, p);
      for (const k of m.cuerpos.values()) if (k.tipo === "animal" && k.x === x && k.z === z) k.contenido = { piel: 1 };
      b.objetivo = null;
      b.estado = "comer";
      b.panico = 20;
    }
  }
}

function posDe(m: Mundo, id: string | null): { x: number; z: number } | null {
  if (!id) return null;
  const c = m.colonos.get(id);
  if (c) return c.vivo && !c.derribado ? c : null;
  const b = m.animales.get(id);
  return b ? { x: b.cuerpo.x, z: b.cuerpo.y } : null;
}

function lobo(m: Mundo, b: Animal, colonos: Colono[], dt: number): void {
  const esp = ESPECIES.get(b.especie)!;
  const c = b.cuerpo;
  const susto = miedo(m, c.x, c.y);
  if (susto || b.vida < esp.vida * 0.4) {
    const de = susto ?? posDe(m, b.ultimoAtacante) ?? { x: c.x + 1, z: c.y };
    b.estado = "huir";
    b.objetivo = null;
    c.velMax = esp.velocidadHuida;
    mover(m, b, [ia.huir(c, de.x, de.z)], dt);
    return;
  }
  if (b.estado === "comer") {
    b.panico -= dt;
    if (b.panico <= 0) b.estado = "deambular";
    return;
  }
  if (m.tick % HZ === b.manada % HZ || !b.objetivo) b.objetivo = presaDeLobo(m, b, colonos);
  const obj = posDe(m, b.objetivo);
  if (!obj || (m.colonos.has(b.objetivo!) && m.aSalvo(obj.x, obj.z))) {
    b.objetivo = null;
    b.estado = "deambular";
    c.velMax = esp.velocidad;
    const manada = [...m.animales.values()].filter((o) => o !== b && o.especie === "lobo" && o.manada === b.manada).map((o) => o.cuerpo);
    mover(m, b, [ia.deambular(c, b.deambular, m.azar.siguiente(), 3, 1.5, 0.35), ia.bandada(c, manada, 8, { separacion: 1.2, alineacion: 0.3, cohesion: 0.6 })], dt);
    return;
  }
  // Ante un grupo despierto de tres o más, la manada duda y se retira.
  if (m.colonos.has(b.objetivo!)) {
    let grupo = 0;
    for (const o of colonos) if (!o.dormido && !o.derribado && d2(o.x, o.z, obj.x, obj.z) < 6) grupo++;
    if (grupo >= 3 && b.ultimoAtacante === null) {
      b.objetivo = null;
      b.panico = 4;
      b.estado = "huir";
      mover(m, b, [ia.huir(c, obj.x, obj.z)], dt);
      return;
    }
  }
  b.estado = "cazar";
  c.velMax = esp.velocidadHuida * 0.85;
  if (d2(obj.x, obj.z, c.x, c.y) > 1.3) {
    mover(m, b, [ia.buscar(c, obj.x, obj.z)], dt);
    return;
  }
  c.vx = c.vy = 0;
  atacar(m, b, b.objetivo!);
}

function presaDeLobo(m: Mundo, b: Animal, colonos: Colono[]): string | null {
  const esp = ESPECIES.get(b.especie)!;
  const c = b.cuerpo;
  const noche = m.esNoche || m.ciclo.fase.nombre === "atardecer";
  const atacante = b.ultimoAtacante ? m.colonos.get(b.ultimoAtacante) : undefined;
  if (atacante?.vivo && d2(atacante.x, atacante.z, c.x, c.y) < esp.vision) return atacante.id;
  let mejor: string | null = null, mp = Infinity;
  if (noche) {
    for (const o of colonos) {
      if (o.derribado || m.aSalvo(o.x, o.z)) continue;
      const d = d2(o.x, o.z, c.x, c.y);
      if (d > esp.vision) continue;
      const p = d * (o.dormido ? 0.5 : 1) * (o.vida < 40 ? 0.7 : 1) * (m.esNino(o) ? 0.6 : 1);
      if (p < mp) { mp = p; mejor = o.id; }
    }
  }
  for (const o of m.animales.values()) {
    if (ESPECIES.get(o.especie)!.conducta !== "presa") continue;
    const d = d2(o.cuerpo.x, o.cuerpo.y, c.x, c.y);
    if (d < esp.vision && d * 1.3 < mp) { mp = d * 1.3; mejor = o.id; }
  }
  return mejor;
}

/** Jabalíes y osos: pacíficos hasta que alguien los molesta o se acerca demasiado. */
function defensivo(m: Mundo, b: Animal, colonos: Colono[], dt: number): void {
  const esp = ESPECIES.get(b.especie)!;
  const c = b.cuerpo;
  if (b.vida < esp.vida * 0.25) {
    const de = posDe(m, b.ultimoAtacante) ?? { x: c.x + 1, z: c.y };
    c.velMax = esp.velocidadHuida;
    b.estado = "huir";
    mover(m, b, [ia.huir(c, de.x, de.z)], dt);
    return;
  }
  if (!b.objetivo && b.especie === "oso") {
    // Un oso ataca a quien se acerca a menos de 4 m (salvo que esté dormido junto al fuego).
    for (const o of colonos) if (!o.derribado && d2(o.x, o.z, c.x, c.y) < 4 && !m.fuegoCerca(c.x, c.y, 6)) { b.objetivo = o.id; break; }
  }
  const obj = posDe(m, b.objetivo);
  if (obj && d2(obj.x, obj.z, c.x, c.y) < 25) {
    b.estado = "cazar";
    c.velMax = esp.velocidadHuida * 0.8;
    if (d2(obj.x, obj.z, c.x, c.y) > 1.5) mover(m, b, [ia.buscar(c, obj.x, obj.z)], dt);
    else { c.vx = c.vy = 0; atacar(m, b, b.objetivo!); }
    return;
  }
  b.objetivo = null;
  b.estado = "deambular";
  c.velMax = esp.velocidad * 0.8;
  mover(m, b, [ia.deambular(c, b.deambular, m.azar.siguiente(), 3, 1.5, 0.3)], dt);
}

/** Poblaciones: presas que reaparecen lejos de la gente; lobos que llegan de noche y se van de día. */
const ultimoAullido = new WeakMap<Mundo, number>();

function poblacion(m: Mundo): void {
  const vivos = m.vivos();
  const cuenta = (e: string): number => { let n = 0; for (const b of m.animales.values()) if (b.especie === e) n++; return n; };
  const invierno = m.estacion === "invierno";
  // Las poblaciones de la configuración son para 576 m; en mapas más grandes crecen con el área (algo menos que lineal).
  const esc = Math.max(1, ((m.config.tam / 576) ** 2) * 0.55);
  if (cuenta("conejo") < m.config.conejos * esc * (invierno ? 0.5 : 1) && m.azar.prob(0.35)) { const l = m.lugarLibre({ evitar: vivos, minDist: 25, biomas: ["pradera", "bosque", "sabana", "taiga"] }); crearAnimal(m, "conejo", l.x, l.z); }
  if (cuenta("ciervo") < m.config.ciervos * esc * (invierno ? 0.6 : 1) && m.azar.prob(0.2)) { const l = m.lugarLibre({ evitar: vivos, minDist: 30, biomas: ["bosque", "pradera", "denso", "taiga", "sabana"] }); crearAnimal(m, "ciervo", l.x, l.z); }
  if (cuenta("jabali") < m.config.jabalies * esc && m.azar.prob(0.12)) { const l = m.lugarLibre({ evitar: vivos, minDist: 30, biomas: ["denso", "bosque", "pantano", "selva"] }); crearAnimal(m, "jabali", l.x, l.z); }
  if (cuenta("oso") < m.config.osos * esc && m.azar.prob(0.03)) { const l = m.lugarLibre({ evitar: vivos, minDist: 40, biomas: ["denso", "roca", "taiga", "nieve"] }); crearAnimal(m, "oso", l.x, l.z); }
  const noche = m.esNoche || m.ciclo.fase.nombre === "atardecer";
  const objNoche = Math.min(m.config.lobosMax * esc, Math.round(m.config.lobosBase * esc + vivos.length * 0.2 + (invierno ? 3 : 0)));
  const objetivo = noche ? objNoche : Math.ceil(objNoche * 0.3);
  const lobos = [...m.animales.values()].filter((b) => b.especie === "lobo");
  if (lobos.length < objetivo) {
    let l = m.lugarLibre({ evitar: vivos, minDist: 35, biomas: ["denso", "bosque", "taiga", "nieve"] });
    if (biomaEn(m.terreno, l.x, l.z) === "agua") l = m.lugarLibre({ evitar: vivos, minDist: 35 });
    const manada = Number(m.nuevoId("m").slice(1));
    const n = Math.min(objetivo - lobos.length, 2 + Math.floor(m.azar.siguiente() * 3));
    for (let i = 0; i < n; i++) crearAnimal(m, "lobo", l.x + m.azar.rango(-1.5, 1.5), l.z + m.azar.rango(-1.5, 1.5), manada);
    // Se avisa solo si la manada aparece cerca de algún pueblo, y como mucho cada 3 horas de juego.
    const cercaPueblo = [...m.tribus.values()].some((t) => !t.extinta && Math.hypot(t.centro.x - l.x, t.centro.z - l.z) < 160);
    if (noche && cercaPueblo && m.tick - (ultimoAullido.get(m) ?? -1e9) > m.ticksDia / 8) {
      ultimoAullido.set(m, m.tick);
      m.emitir("aullidos", "Se oyen aullidos en el bosque.", { x: l.x, z: l.z, interes: 1, datos: { lobos: n } });
    }
  } else if (lobos.length > objetivo) {
    const l = lobos.find((b) => !b.objetivo && vivos.every((a) => d2(a.x, a.z, b.cuerpo.x, b.cuerpo.y) > 35));
    if (l) m.animales.delete(l.id);
  }
}
