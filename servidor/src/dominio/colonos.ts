// Colonos: nacimiento (rasgos compatibles, personalidad, trasfondo, habilidades con pasión, apariencia), cómo
// los rasgos modifican sus estadísticas, el cuerpo (necesidades de TxNucleo, temperatura, enfermedad, vejez),
// el daño y la muerte con sus consecuencias en los demás.

import { bono as bonoMejora } from "./tecnologia.ts";
import { narrativa, supervivencia } from "txnucleo";
import { ESTRUCTURAS, OBJETOS } from "./catalogo.ts";
import { EJES, HABILIDADES, TRABAJOS, HABILIDAD_DE, type Conducta, type Habilidad, type Personalidad, type Stat, type Trabajo } from "./datos/esquema.ts";
import { RASGO_POR_ID, RASGOS } from "./datos/rasgos.ts";
import { APODOS, BARBAS, COLORES_PELO, COMPLEXIONES, NOMBRES_F, NOMBRES_M, PEINADOS, PIELES, TRASFONDO_POR_ID, TRASFONDOS } from "./datos/trasfondos.ts";
import { recordar } from "./animo.ts";
import { aportar } from "./tecnologia.ts";
import { HZ, dist, type Mundo } from "./mundo.ts";
import type { Colono, Cuerpo, NivelHabilidad, Tribu } from "./tipos.ts";
import type { Rasgo } from "./datos/esquema.ts";

// ------------------------------------------------------------ rasgos activos y estadísticas

export function rasgosDe(c: Colono): Rasgo[] {
  const r = c.rasgos.map((id) => RASGO_POR_ID.get(id)!).filter(Boolean);
  if (c.rasgoTemporal) {
    const t = RASGO_POR_ID.get(c.rasgoTemporal.id);
    if (t) r.push(t);
  }
  return r;
}

export function tiene(c: Colono, conducta: Conducta): boolean {
  return rasgosDe(c).some((r) => r.efectos.conductas?.includes(conducta));
}

/** ¿Tiene este rasgo (por id)? */
export function tieneRasgo(c: Colono, id: string): boolean {
  return c.rasgos.includes(id) || c.rasgoTemporal?.id === id;
}

/** Multiplicador de una estadística (1 = normal). */
export function stat(c: Colono, s: Stat): number {
  let v = 1;
  for (const r of rasgosDe(c)) v *= r.efectos.stats?.[s] ?? 1;
  if (s === "trabajo" && c.inspiracion) v *= 1.5;
  if (s === "velocidad" && c.vida < 40) v *= 0.7;
  if (s === "trabajo" && c.enfermedad) v *= 1 - c.enfermedad.severidad * 0.5;
  return v;
}

/** Factor de habilidad: 0.55 (novato) .. 1.85 (maestro). */
export function destreza(c: Colono, h: Habilidad): number {
  return 0.55 + c.habilidades[h].nivel * 0.065;
}

export function ganarXp(m: Mundo, c: Colono, h: Habilidad, cantidad: number): void {
  const n = c.habilidades[h];
  // Todo trabajo enseña algo a la tribu.
  const tribu = m.tribus.get(c.tribu);
  if (tribu && h !== "saber") aportar(m, tribu, cantidad * 0.012 * stat(c, "aprendizaje"));
  if (n.nivel >= 20) return;
  n.xp += cantidad * stat(c, "aprendizaje") * (n.pasion === 2 ? 2 : n.pasion === 1 ? 1.4 : 0.8);
  const necesita = 60 + n.nivel * 35;
  if (n.xp >= necesita) {
    n.xp -= necesita;
    n.nivel++;
    if (n.nivel % 5 === 0) m.emitir("maestria", `${c.nombre} alcanza nivel ${n.nivel} en ${h}.`, { x: c.x, z: c.z, actores: [c.id], interes: 1, tribu: c.tribu });
  }
}

/** Gusto actual por un trabajo (0 = se niega). */
export function gusto(c: Colono, t: Trabajo): number {
  let g = c.gustos[t];
  if (c.rasgoTemporal) g *= RASGO_POR_ID.get(c.rasgoTemporal.id)?.efectos.trabajo?.[t] ?? 1;
  return g;
}

export function velocidad(c: Colono): number {
  let v = 1.7 * stat(c, "velocidad");
  if (c.necesidades.valor("energia") <= 0) v *= 0.6;
  if (c.carga && Object.values(c.carga).reduce((s, n) => s + n, 0) > capacidad(c) * 0.8) v *= 0.85;
  return v;
}

export function capacidad(c: Colono): number {
  return Math.round(24 * stat(c, "fuerza"));
}

export function cargaTotal(c: Colono): number {
  return Object.values(c.carga).reduce((s, n) => s + n, 0);
}

// ------------------------------------------------------------ necesidades

export function definirNecesidades(segundosPorDia: number): supervivencia.DefNecesidad[] {
  const tasa = (dias: number): number => 100 / (dias * segundosPorDia);
  const h = tasa(1.3), s = tasa(0.9), e = tasa(1.15), o = tasa(1.6), so = tasa(1.8);
  return [
    { id: "hambre", max: 100, tasa: { base: h, trabajando: h * 1.3, durmiendo: h * 0.5 }, umbrales: [[0.25, "hambriento"]], danioVacio: 100 / (segundosPorDia / 3) },
    { id: "sed", max: 100, tasa: { base: s, trabajando: s * 1.4, durmiendo: s * 0.5 }, umbrales: [[0.25, "sediento"]], danioVacio: 100 / (segundosPorDia / 4) },
    { id: "energia", max: 100, tasa: { base: e, trabajando: e * 1.4, durmiendo: 0 }, umbrales: [[0.2, "cansado"]] },
    { id: "ocio", max: 100, tasa: { base: o, trabajando: o * 1.3, durmiendo: 0 } },
    { id: "social", max: 100, tasa: { base: so, durmiendo: 0 } },
  ];
}

// ------------------------------------------------------------ nacimiento

function elegirRasgos(m: Mundo, cuantos: number, previos: string[] = []): string[] {
  const elegidos = [...previos];
  for (let intento = 0; elegidos.length < cuantos && intento < 200; intento++) {
    const total = RASGOS.reduce((s, r) => s + r.frecuencia, 0);
    let x = m.azar.siguiente() * total;
    let r = RASGOS[0];
    for (const c of RASGOS) {
      x -= c.frecuencia;
      if (x <= 0) { r = c; break; }
    }
    if (elegidos.includes(r.id)) continue;
    if (elegidos.some((e) => r.incompatibles?.includes(e) || RASGO_POR_ID.get(e)!.incompatibles?.includes(r.id))) continue;
    if (r.valencia === -1 && elegidos.filter((e) => RASGO_POR_ID.get(e)!.valencia === -1).length >= 2) continue;
    elegidos.push(r.id);
  }
  return elegidos;
}

function normal(m: Mundo): number {
  return Math.max(-1, Math.min(1, ((m.azar.siguiente() + m.azar.siguiente() + m.azar.siguiente()) / 3 - 0.5) * 3.2));
}

function nombreLibre(m: Mundo, sexo: "f" | "m"): string {
  const lista = sexo === "f" ? NOMBRES_F : NOMBRES_M;
  const usados = new Set([...m.colonos.values()].filter((c) => c.vivo).map((c) => c.nombre));
  const libres = lista.filter((n) => !usados.has(n));
  if (libres.length) return libres[Math.floor(m.azar.siguiente() * libres.length)];
  for (let i = 0; i < 40; i++) {
    const n = `${lista[Math.floor(m.azar.siguiente() * lista.length)]} ${APODOS[Math.floor(m.azar.siguiente() * APODOS.length)]}`;
    if (!usados.has(n)) return n;
  }
  return `${lista[0]} ${m.tick}`;
}

export interface OpcionesColono {
  readonly tribu: string;
  readonly x: number;
  readonly z: number;
  readonly edad?: number;
  readonly padres?: readonly Colono[];
}

export function crearColono(m: Mundo, op: OpcionesColono): Colono {
  const az = m.azar;
  const elegir = <T>(l: readonly T[]): T => l[Math.floor(az.siguiente() * l.length)];
  const padres = op.padres ?? [];
  const edad = op.edad ?? Math.round(az.rango(18, 52));
  const sexo: "f" | "m" = az.prob(0.5) ? "f" : "m";
  const ap = {
    piel: padres.length ? padres[Math.floor(az.siguiente() * padres.length)].apariencia.piel : Math.floor(az.siguiente() * PIELES.length),
    pelo: Math.floor(az.siguiente() * PEINADOS.length),
    colorPelo: padres.length && az.prob(0.7) ? padres[0].apariencia.colorPelo : edad > 55 && az.prob(0.6) ? 6 + Math.floor(az.siguiente() * 2) : az.prob(0.08) ? 8 : Math.floor(az.siguiente() * 6),
    barba: sexo === "m" && edad >= 16 ? Math.floor(az.siguiente() * BARBAS.length) : 0,
    complexion: Math.floor(az.siguiente() * COMPLEXIONES.length),
    altura: Math.round(az.rango(0.9, 1.1) * 100) / 100,
    sexo,
  };
  // Rasgos: 2-4; los hijos pueden heredar uno de cada padre.
  const heredados = padres.flatMap((p) => (az.prob(0.35) ? [elegir(p.rasgos)] : []));
  const rasgos = elegirRasgos(m, 2 + Math.floor(az.siguiente() * 3), [...new Set(heredados)].slice(0, 2));
  const personalidad = Object.fromEntries(EJES.map((e) => [e, padres.length ? Math.max(-1, Math.min(1, (padres.reduce((s, p) => s + p.personalidad[e], 0) / padres.length) * 0.5 + normal(m) * 0.6)) : normal(m)])) as Personalidad;
  const infancias = TRASFONDOS.filter((t) => t.etapa === "infancia");
  const adulteces = TRASFONDOS.filter((t) => t.etapa === "adultez");
  const trasfondo = { infancia: elegir(infancias).id, adultez: edad >= 20 ? elegir(adulteces).id : null };
  const habilidades = {} as Record<Habilidad, NivelHabilidad>;
  for (const h of HABILIDADES) {
    let nivel = edad < 14 ? 0 : Math.floor(az.siguiente() * 4) + Math.floor(Math.min(edad, 50) / 15);
    for (const t of [trasfondo.infancia, trasfondo.adultez]) if (t) nivel += TRASFONDO_POR_ID.get(t)!.habilidades[h] ?? 0;
    const r = az.siguiente();
    let pasion: 0 | 1 | 2 = r < 0.1 ? 2 : r < 0.32 ? 1 : 0;
    const trabajosDeH = TRABAJOS.filter((t) => HABILIDAD_DE[t] === h);
    if (trabajosDeH.some((t) => rasgos.some((id) => (RASGO_POR_ID.get(id)!.efectos.trabajo?.[t] ?? 1) >= 1.8))) pasion = Math.max(pasion, 1) as 1 | 2;
    habilidades[h] = { nivel: Math.max(0, Math.min(20, nivel)), xp: 0, pasion };
  }
  const gustos = {} as Record<Trabajo, number>;
  for (const t of TRABAJOS) {
    let g = 1;
    for (const id of rasgos) g *= RASGO_POR_ID.get(id)!.efectos.trabajo?.[t] ?? 1;
    const h = habilidades[HABILIDAD_DE[t]];
    g *= 1 + 0.3 * h.pasion;
    if (t === "pelear" || t === "vigilar") g *= 1 + 0.35 * personalidad.valiente;
    if (t === "curar") g *= 1 + 0.3 * personalidad.empatico;
    if (t === "comerciar") g *= 1 + 0.3 * personalidad.sociable;
    for (const tf of [trasfondo.infancia, trasfondo.adultez]) if (tf && TRASFONDO_POR_ID.get(tf)!.niega?.includes(t)) g = 0;
    gustos[t] = Math.max(0, Math.round(g * 100) / 100);
  }
  const c: Colono = {
    id: m.nuevoId("c"), nombre: nombreLibre(m, sexo), tribu: op.tribu, nacio: m.tick, edadInicial: edad,
    apariencia: ap, rasgos, personalidad, trasfondo, habilidades,
    necesidades: new supervivencia.Necesidades(definirNecesidades(m.config.segundosPorDia)),
    x: op.x, z: op.z, rumbo: az.rango(0, Math.PI * 2), vida: 100, temperatura: 37, vivo: true, causaMuerte: null, murio: null,
    ultimoDanio: null, derribado: false, dormido: false, actividad: null, pensamientos: [], animo: 55, crisis: null, inspiracion: null,
    rasgoTemporal: null, enfermedad: null, carga: {}, equipo: { arma: null, herramienta: null, ropa: null, armadura: null },
    memoria: new narrativa.MemoriaNarrativa(80), pareja: null, padres: padres.map((p) => p.id), hijos: [], cama: null, dijo: null,
    gustos, cooldownGolpe: 0, proximaDecision: m.tick + Math.floor(az.siguiente() * HZ * 2), proximoSocial: m.tick + Math.floor(az.siguiente() * HZ * 6),
    historia: [], stats: {},
  };
  for (const p of padres) p.hijos.push(c.id);
  m.colonos.set(c.id, c);
  return c;
}

// ------------------------------------------------------------ cuerpo (cada tick)

export function sistemaCuerpos(m: Mundo, dt: number): void {
  for (const c of m.colonos.values()) {
    if (!c.vivo) continue;
    const act = c.actividad?.tipo ?? "";
    const actividad = c.dormido ? "durmiendo" : ["talar", "minar", "construir", "pelear", "recolectar", "cazar", "fabricar", "cosechar", "sembrar", "apagar"].includes(act) ? "trabajando" : "base";
    const lento = c.derribado ? 0.25 : 1;
    const danio = c.necesidades.actualizar(dt, actividad, { hambre: stat(c, "apetito") * lento, sed: lento, energia: stat(c, "sueno") * lento, ocio: lento, social: lento });
    if (danio > 0) {
      daniar(m, c, danio, c.necesidades.valor("sed") <= 0 ? "sed" : "hambre", true);
      if (!c.vivo) continue;
    }
    const refugio = m.refugioEn(c.x, c.z);
    if (c.dormido) {
      const mult = refugio?.tipo === "casa" ? 1.6 : refugio ? 1.3 : 1;
      c.necesidades.reponer("energia", (100 / (m.config.segundosPorDia * 0.3)) * mult * dt);
    }
    // Temperatura corporal: hacia una de confort según el ambiente, el fuego, la ropa, el refugio y los rasgos.
    let ambiente = m.temperaturaEn(c.x, c.z);
    const fuego = m.fuegoCerca(c.x, c.z, 6);
    if (fuego) ambiente += 22 * (1 - Math.hypot(fuego.x - c.x, fuego.z - c.z) / 6) + 6;
    // Un techo con paredes guarda calor (más si es de piedra).
    if (refugio) ambiente += ESTRUCTURAS.get(refugio.tipo)!.aislamiento! * 30;
    if (m.incendios.size) {
      const k = `${Math.floor(c.x)},${Math.floor(c.z)}`;
      if (m.incendios.has(k)) daniar(m, c, 6 * dt, "fuego", true);
      if (!c.vivo) continue;
    }
    let tolerancia = 0;
    for (const r of rasgosDe(c)) tolerancia += ambiente < 18 ? r.efectos.toleraFrio ?? 0 : r.efectos.toleraCalor ?? 0;
    const ropa = c.equipo.ropa ? OBJETOS.get(c.equipo.ropa)?.ropa?.abrigo ?? 0 : 0;
    const aislamiento = Math.max(ropa, refugio ? ESTRUCTURAS.get(refugio.tipo)!.aislamiento! : 0);
    const efectivo = ambiente + tolerancia;
    const objetivo = efectivo < 16 ? 37 - (16 - efectivo) * 0.3 : efectivo > 32 ? 37 + (efectivo - 32) * 0.22 : 37;
    c.temperatura = supervivencia.temperaturaCorporal(c.temperatura, objetivo, aislamiento, dt, 0.004);
    if (c.temperatura < 34) daniar(m, c, (34 - c.temperatura) * 0.04 * dt, "frio", true);
    else if (c.temperatura > 40) daniar(m, c, (c.temperatura - 40) * 0.08 * dt, "calor", true);
    if (!c.vivo) continue;
    // Enfermedad.
    if (c.enfermedad) {
      const e = c.enfermedad;
      const atendido = (c.stats.atendidoHasta ?? 0) > m.tick;
      e.inmunidad += (dt / m.config.segundosPorDia) * 0.55 * stat(c, "curacion") * (atendido ? 1.8 : 1) * (c.dormido ? 1.3 : 1);
      e.severidad += (dt / m.config.segundosPorDia) * 0.4;
      daniar(m, c, e.severidad * 0.04 * dt, "enfermedad", true);
      if (!c.vivo) continue;
      if (e.inmunidad >= e.severidad + 0.2 || e.inmunidad >= 1) {
        c.enfermedad = null;
        m.emitir("sana", `${c.nombre} se recupera de la fiebre.`, { x: c.x, z: c.z, actores: [c.id], interes: 1, tribu: c.tribu });
      }
    }
    // Regeneración.
    if (c.vida < 100 && c.necesidades.valor("hambre") > 25 && c.necesidades.valor("sed") > 25 && c.temperatura > 35 && !c.enfermedad) {
      const atendido = (c.stats.atendidoHasta ?? 0) > m.tick ? 2.5 : 1;
      c.vida = Math.min(100, c.vida + 0.035 * stat(c, "curacion") * atendido * (c.dormido ? 2 : 1) * dt);
      if (c.derribado && c.vida > 30) {
        c.derribado = false;
        m.emitir("levanta", `${c.nombre} logra ponerse en pie.`, { x: c.x, z: c.z, actores: [c.id], interes: 1, tribu: c.tribu });
      }
    }
    if (c.derribado) {
      // Desangrarse solo al principio; después la herida se cierra y empieza a reponerse.
      const desde = c.stats.derribadoDesde ?? (c.stats.derribadoDesde = m.tick);
      if (m.tick - desde < m.ticksDia * 0.08) daniar(m, c, 0.02 * dt, c.ultimoDanio ?? "heridas", true);
      else c.vida = Math.min(100, c.vida + 0.02 * dt);
      if (c.vida > 30) { c.derribado = false; delete c.stats.derribadoDesde; }
    } else if (c.stats.derribadoDesde !== undefined) delete c.stats.derribadoDesde;
    if (c.cooldownGolpe > 0) c.cooldownGolpe -= dt;
    if (c.inspiracion && m.tick > c.inspiracion.hasta) c.inspiracion = null;
    if (c.rasgoTemporal && m.tick > c.rasgoTemporal.hasta) c.rasgoTemporal = null;
    // Vejez.
    if (m.tick % (HZ * 30) === 0) {
      const edad = m.edad(c);
      // Vejez: a partir de los 60 cada año es más probable morir (esperanza de vida ~70-75).
      if (edad > 60 && m.azar.prob(((edad - 60) / 15) * ((HZ * 30) / m.ticksAnio) * 0.5)) {
        c.ultimoDanio = "vejez";
        matar(m, c);
      }
    }
  }
}

// ------------------------------------------------------------ daño y muerte

/** Daña a un colono. `silencioso`: no interrumpe (hambre, frío). */
export function daniar(m: Mundo, c: Colono, cantidad: number, fuente: string, silencioso = false): void {
  if (!c.vivo || cantidad <= 0) return;
  const armadura = c.equipo.armadura ? OBJETOS.get(c.equipo.armadura)?.armadura ?? 1 : 1;
  const efectivo = silencioso ? cantidad : cantidad / (stat(c, "defensa") * armadura * bonoMejora(m.tribus.get(c.tribu), "armadura"));
  c.vida -= efectivo;
  c.ultimoDanio = fuente;
  if (!silencioso && c.dormido) {
    c.dormido = false;
    c.actividad = null;
  }
  if (c.vida <= 0) return matar(m, c);
  if (c.vida < 12 && !c.derribado && !silencioso) {
    c.derribado = true;
    c.dormido = false;
    c.actividad = null;
    m.emitir("derribado", `${c.nombre} cae malherido.`, { x: c.x, z: c.z, actores: [c.id], interes: 2, tribu: c.tribu });
  }
}

export function causaTexto(m: Mundo, fuente: string): string {
  const asesino = m.colonos.get(fuente);
  if (asesino) return `a manos de ${asesino.nombre}`;
  const t: Record<string, string> = {
    lobo: "atacado por lobos", oso: "atacado por un oso", jabali: "corneado por un jabalí", frio: "de frío", calor: "de calor",
    hambre: "de hambre", sed: "de sed", fuego: "en un incendio", enfermedad: "de fiebre", vejez: "de viejo", rayo: "fulminado por un rayo",
    meteorito: "aplastado por un meteorito", heridas: "por sus heridas", divino: "por voluntad de los dioses",
  };
  return t[fuente] ?? fuente;
}

export function matar(m: Mundo, c: Colono): void {
  if (!c.vivo) return;
  c.vivo = false;
  c.vida = 0;
  c.murio = m.tick;
  c.dormido = false;
  c.derribado = false;
  c.actividad = null;
  const fuente = c.ultimoDanio ?? "heridas";
  c.causaMuerte = causaTexto(m, fuente);
  for (const t of m.tareas.values()) if (t.asignado === c.id) t.asignado = null;
  const contenido: Record<string, number> = { ...c.carga };
  for (const e of [c.equipo.arma, c.equipo.herramienta, c.equipo.ropa, c.equipo.armadura]) if (e) contenido[e] = (contenido[e] ?? 0) + 1;
  const cuerpo: Cuerpo = { id: m.nuevoId("k"), tipo: "colono", nombre: c.nombre, x: c.x, z: c.z, contenido, expira: m.tick + m.ticksDia * 2, colono: c.id };
  m.cuerpos.set(cuerpo.id, cuerpo);
  const tribu = m.tribus.get(c.tribu);
  m.emitir("muerte", `${c.nombre}${tribu ? ` (${tribu.nombre})` : ""} ha muerto ${c.causaMuerte}, a los ${Math.floor(m.edad(c))} años.`, { x: c.x, z: c.z, actores: [c.id], interes: 3, tribu: c.tribu, datos: { causa: fuente } });
  // Duelo de los demás.
  for (const o of m.colonos.values()) {
    if (!o.vivo || o.id === c.id) continue;
    const familia = o.pareja === c.id || c.padres.includes(o.id) || o.padres.includes(c.id);
    const op = o.memoria.relacion(c.id);
    if (familia) recordar(m, o, "muerte_familiar", -22, `Ha muerto ${c.nombre}, de mi familia`, 3, c.id);
    else if (op > 25 && o.tribu === c.tribu) recordar(m, o, "muerte_amigo", -12, `Ha muerto mi amigo ${c.nombre}`, 2, c.id);
    else if (dist(o, c) < 15) recordar(m, o, "muerte_vista", -5, `Vi morir a ${c.nombre}`, 1, c.id);
    if (o.pareja === c.id) o.pareja = null;
  }
  const asesino = m.colonos.get(fuente);
  if (asesino) {
    recordar(m, asesino, "mato_persona", -8, `Maté a ${c.nombre}`, 2, c.id);
    asesino.stats.muertes = (asesino.stats.muertes ?? 0) + 1;
    if (asesino.tribu !== c.tribu && tribu) {
      const ta = m.tribus.get(asesino.tribu);
      if (ta) {
        tribu.relaciones[ta.id] = Math.max(-100, (tribu.relaciones[ta.id] ?? 0) - 25);
      }
    }
  }
  c.pareja = null;
  if (c.cama) {
    const cama = m.estructuras.get(c.cama);
    if (cama) cama.ocupantes = cama.ocupantes.filter((i) => i !== c.id);
    c.cama = null;
  }
  if (tribu?.lider === c.id) tribu.lider = null;
}

/** Revive a un colono muerto (poder de dios). */
export function resucitar(m: Mundo, c: Colono, x: number, z: number): void {
  c.vivo = true;
  c.vida = 60;
  c.murio = null;
  c.causaMuerte = null;
  c.ultimoDanio = null;
  c.x = x;
  c.z = z;
  c.necesidades.reponer("hambre", 50);
  c.necesidades.reponer("sed", 50);
  c.temperatura = 37;
  c.proximaDecision = m.tick + HZ;
  if (!m.tribus.get(c.tribu) || m.tribus.get(c.tribu)!.extinta) {
    const viva = [...m.tribus.values()].find((t) => !t.extinta);
    if (viva) c.tribu = viva.id;
  }
}

/** Tribu del colono (lanza si no existe: bug). */
export function tribuDe(m: Mundo, c: Colono): Tribu {
  const t = m.tribus.get(c.tribu);
  if (!t) throw new Error(`tribu ${c.tribu} no existe`);
  return t;
}
