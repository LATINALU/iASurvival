// Ánimo de los colonos = 50 + rasgos + recuerdos (temporales) + pensamientos situacionales (lo que pasa ahora).
// Los rasgos amplifican, atenúan o invierten cada recuerdo. Con ánimo muy bajo llegan las CRISIS (según los
// rasgos: furia, huida, atracón, robo, incendio, encierro…); con ánimo muy alto, la INSPIRACIÓN.

import { ESPECIES } from "./catalogo.ts";
import type { Condicion, Recuerdo } from "./datos/esquema.ts";
import { rasgosDe, tiene } from "./colonos.ts";
import { HZ, dist, type Mundo } from "./mundo.ts";
import { biomaEn } from "./terreno.ts";
import type { Colono } from "./tipos.ts";

/** Deja un recuerdo (con la reacción de los rasgos). `dias`: cuánto dura. `de`: quién lo causó. */
export function recordar(m: Mundo, c: Colono, tipo: Recuerdo, base: number, texto: string, dias: number, de?: string): void {
  if (!c.vivo) return;
  let v = base;
  for (const r of rasgosDe(c)) {
    v *= r.efectos.reacciones?.[tipo] ?? 1;
    v *= r.efectos.intensidad ?? 1;
  }
  v = Math.round(v * 10) / 10;
  if (Math.abs(v) < 0.5) return;
  const id = `${tipo}${de ? `:${de}` : ""}`;
  const previo = c.pensamientos.findIndex((p) => p.id === id);
  const p = { id, texto: v * base < 0 ? `${texto} (y me gustó)` : texto, valor: v, hasta: m.tick + Math.round(dias * m.ticksDia), de };
  if (previo >= 0) c.pensamientos[previo] = p;
  else c.pensamientos.push(p);
  if (c.pensamientos.length > 24) c.pensamientos.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)).splice(24);
}

/** ¿Se cumple una condición para este colono ahora? */
export function condicion(m: Mundo, c: Colono, k: Condicion, ctx: Contexto): boolean {
  switch (k) {
    case "lluvia": return m.lloviendo && !ctx.techo;
    case "tormenta": return m.clima.tipo === "tormenta";
    case "nieve": return m.clima.tipo === "nieve" && !ctx.techo;
    case "noche": return m.esNoche;
    case "dia": return !m.esNoche && m.ciclo.fase.nombre !== "atardecer";
    case "oscuridad": return m.esNoche && !ctx.fuego && !ctx.techo;
    case "solo": return ctx.cercanos12 === 0;
    case "acompanado": return ctx.cercanos6 >= 1;
    case "multitud": return ctx.cercanos6 >= 5;
    case "fuego_cerca": return !!ctx.fuego;
    case "en_casa": return ctx.techo;
    case "intemperie": return !ctx.techo;
    case "bosque": { const b = biomaEn(m.terreno, c.x, c.z); return b === "bosque" || b === "denso"; }
    case "frio": return c.temperatura < 35.5;
    case "calor": return c.temperatura > 38.5;
    case "trabajando": return !!c.actividad && ctx.trabajando;
    case "ocioso": return !c.actividad || c.actividad.tipo === "ocio";
    case "combate": return ctx.combate;
    case "herido": return c.vida < 60;
    case "animales_cerca": return ctx.presas;
    case "lobos_cerca": return ctx.lobos;
    case "lleno": return c.necesidades.valor("hambre") > 80;
    case "hambre": return c.necesidades.valor("hambre") < 25;
    case "pareja_cerca": return ctx.pareja;
    case "ninos_cerca": return ctx.ninos;
    case "lider_cerca": return ctx.lider;
    case "totem_cerca": return ctx.totem;
    case "flores_cerca": return ctx.flores;
    case "estrellas": return m.esNoche && m.clima.tipo === "despejado" && !ctx.techo;
  }
}

export interface Contexto {
  techo: boolean; fuego: boolean; cercanos6: number; cercanos12: number; trabajando: boolean; combate: boolean;
  presas: boolean; lobos: boolean; pareja: boolean; ninos: boolean; lider: boolean; totem: boolean; flores: boolean;
}

const TRABAJOS_VISIBLES = new Set(["talar", "minar", "recolectar", "cazar", "cocinar", "construir", "sembrar", "cosechar", "curar", "vigilar", "fabricar", "avivar", "apagar", "depositar", "comerciar"]);

export function contexto(m: Mundo, c: Colono): Contexto {
  let cercanos6 = 0, cercanos12 = 0, pareja = false, ninos = false, lider = false, combate = false;
  const t = m.tribus.get(c.tribu);
  for (const o of m.colonosCerca(c.x, c.z, 12)) {
    if (!o.vivo || o.id === c.id) continue;
    const d = dist(o, c);
    if (d < 12) {
      cercanos12++;
      if (d < 6) cercanos6++;
      if (o.tribu !== c.tribu && (t?.relaciones[o.tribu] ?? 0) < -50 && d < 12) combate = true;
      if (d < 6 && o.id === c.pareja) pareja = true;
      if (d < 8 && m.esNino(o)) ninos = true;
      if (d < 8 && t?.lider === o.id) lider = true;
    }
  }
  let presas = false, lobos = false;
  for (const b of m.animalesCerca(c.x, c.z, 15)) {
    const d = Math.hypot(b.cuerpo.x - c.x, b.cuerpo.y - c.z);
    if (d < 10 && ESPECIES.get(b.especie)!.conducta === "presa") presas = true;
    if (d < 15 && b.especie === "lobo") lobos = true;
  }
  let totem = false, flores = false;
  for (const e of m.estructurasCerca(c.x, c.z, 8)) {
    if (e.progreso < 1) continue;
    const d = dist(e, c);
    if (e.tipo === "totem" && e.tribu === c.tribu && d < 8) totem = true;
    if (e.tipo === "huerto" && d < 6 && e.cultivo > 0.3) flores = true;
  }
  if (!flores && (m.estacion === "primavera" || m.estacion === "verano") && biomaEn(m.terreno, c.x, c.z) === "pradera") flores = true;
  const tipo = c.actividad?.tipo ?? "";
  if (tipo === "pelear" || tipo === "defender" || tipo === "incursion") combate = true;
  return {
    techo: !!m.refugioEn(c.x, c.z), fuego: !!m.fuegoCerca(c.x, c.z, 5), cercanos6, cercanos12,
    trabajando: TRABAJOS_VISIBLES.has(tipo), combate, presas, lobos, pareja, ninos, lider, totem, flores,
  };
}

/** Pensamientos situacionales de ahora (rasgos + necesidades + condiciones generales). */
export function situacion(m: Mundo, c: Colono, ctx = contexto(m, c)): Array<{ texto: string; valor: number }> {
  const r: Array<{ texto: string; valor: number }> = [];
  for (const rasgo of rasgosDe(c)) {
    for (const p of rasgo.efectos.pensamientos ?? []) if (condicion(m, c, p.cuando, ctx)) r.push({ texto: p.texto, valor: p.valor });
  }
  const n = (id: string): number => c.necesidades.valor(id);
  if (n("hambre") < 10) r.push({ texto: "Me muero de hambre", valor: -18 });
  else if (n("hambre") < 25) r.push({ texto: "Tengo hambre", valor: -8 });
  if (n("sed") < 10) r.push({ texto: "Me muero de sed", valor: -18 });
  else if (n("sed") < 25) r.push({ texto: "Tengo sed", valor: -8 });
  if (n("energia") < 15) r.push({ texto: "Estoy agotado", valor: -10 });
  else if (n("energia") < 30) r.push({ texto: "Tengo sueño", valor: -4 });
  if (n("ocio") < 20) r.push({ texto: "Me aburro", valor: -5 });
  if (n("social") < 20 && !tiene(c, "ermitano")) r.push({ texto: "Nadie habla conmigo", valor: -5 });
  if (c.temperatura < 35) r.push({ texto: "Paso mucho frío", valor: -10 });
  else if (c.temperatura < 36) r.push({ texto: "Tengo frío", valor: -4 });
  if (c.temperatura > 39) r.push({ texto: "Me ahogo de calor", valor: -8 });
  if (c.vida < 30) r.push({ texto: "Estoy malherido", valor: -12 });
  else if (c.vida < 70) r.push({ texto: "Me duelen las heridas", valor: -4 });
  if (c.enfermedad) r.push({ texto: "Tengo fiebre", valor: -8 });
  if (c.cama) r.push({ texto: "Tengo un sitio donde dormir", valor: 3 });
  else if (!m.esNino(c)) r.push({ texto: "No tengo cama", valor: -4 });
  if (c.pareja) r.push({ texto: "Tengo a alguien que me quiere", valor: 5 });
  if (c.inspiracion) r.push({ texto: "Me siento inspirado", valor: 10 });
  const t = m.tribus.get(c.tribu);
  if (t && Object.values(t.relaciones).some((v) => v <= -60)) r.push({ texto: "Mi tribu está en guerra", valor: -3 });
  if (t) {
    const estructuras = [...m.estructuras.values()].filter((e) => e.tribu === t.id && e.progreso >= 1).length;
    if (estructuras >= 8) r.push({ texto: "Nuestro poblado prospera", valor: 4 });
  }
  return r;
}

/** Recalcula el ánimo (y olvida recuerdos vencidos). */
export function calcularAnimo(m: Mundo, c: Colono, ctx?: Contexto): number {
  c.pensamientos = c.pensamientos.filter((p) => p.hasta > m.tick);
  let a = 50;
  for (const r of rasgosDe(c)) a += r.efectos.animo ?? 0;
  for (const p of c.pensamientos) a += p.valor;
  for (const s of situacion(m, c, ctx)) a += s.valor;
  c.animo = Math.max(0, Math.min(100, Math.round(a)));
  return c.animo;
}

const CRISIS: Record<string, string> = {
  furia: "entra en furia", huida: "huye presa del pánico", atracon: "se da un atracón", encierro: "se encierra en sí mismo",
  robo: "roba por desesperación", incendio: "prende fuego al poblado", depresion: "cae en la desesperanza", vagar: "vaga sin rumbo",
};

/** Sistema de ánimo: cada 2 s recalcula; cada 10 s tira crisis o inspiración. */
export function sistemaAnimo(m: Mundo, _dt: number): void {
  for (const c of m.colonos.values()) {
    if (!c.vivo) continue;
    if ((m.tick + c.nacio) % (HZ * 2) !== 0) continue;
    calcularAnimo(m, c);
    if (c.crisis && m.tick > c.crisis.hasta) {
      m.emitir("crisis_fin", `${c.nombre} recupera la calma.`, { x: c.x, z: c.z, actores: [c.id], interes: 1, tribu: c.tribu });
      c.crisis = null;
      c.actividad = null;
      recordar(m, c, "crisis_ajena", 10, "Me desahogué", 1);
      continue;
    }
    if ((m.tick + c.nacio) % (HZ * 10) !== 0 || c.crisis || c.derribado || m.esNino(c)) continue;
    let mult = 1;
    for (const r of rasgosDe(c)) mult *= r.efectos.crisis ?? 1;
    if (c.animo < 22 && m.tick - (c.stats.ultimaCrisis ?? -1e9) > m.ticksDia && m.azar.prob(((22 - c.animo) / 120) * mult)) iniciarCrisis(m, c);
    else if (c.animo > 85 && !c.inspiracion && m.azar.prob(0.006)) {
      c.inspiracion = { hasta: m.tick + Math.round(m.ticksDia * 0.5) };
      m.emitir("inspiracion", `${c.nombre} se siente inspirado: trabajará el doble.`, { x: c.x, z: c.z, actores: [c.id], interes: 2, tribu: c.tribu });
    }
  }
}

export function iniciarCrisis(m: Mundo, c: Colono, forzada?: string): void {
  const opciones: string[] = [];
  if (tiene(c, "piromano")) opciones.push("incendio", "incendio");
  if (tiene(c, "gloton")) opciones.push("atracon", "atracon");
  if (tiene(c, "cleptomano") || tiene(c, "avaro")) opciones.push("robo");
  if (tiene(c, "cobarde")) opciones.push("huida", "huida");
  if (c.personalidad.impulsivo > 0.3 || tiene(c, "sanguinario")) opciones.push("furia");
  if (tiene(c, "pacifista")) for (let i = opciones.length - 1; i >= 0; i--) if (opciones[i] === "furia") opciones.splice(i, 1);
  opciones.push("depresion", "vagar", "encierro");
  const tipo = forzada ?? opciones[Math.floor(m.azar.siguiente() * opciones.length)];
  c.crisis = { tipo, hasta: m.tick + Math.round(m.ticksDia * m.azar.rango(0.06, 0.14)) };
  c.stats.ultimaCrisis = m.tick;
  c.actividad = null;
  c.dormido = false;
  for (const t of m.tareas.values()) if (t.asignado === c.id) t.asignado = null;
  m.emitir("crisis", `${c.nombre} ${CRISIS[tipo] ?? tipo}.`, { x: c.x, z: c.z, actores: [c.id], interes: 3, tribu: c.tribu, datos: { tipo } });
  for (const o of m.colonos.values()) if (o.vivo && o.id !== c.id && o.tribu === c.tribu && dist(o, c) < 15) recordar(m, o, "crisis_ajena", -3, `${c.nombre} perdió la cabeza`, 0.5, c.id);
}

