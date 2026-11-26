// Vida social: cuando dos colonos están cerca, a veces interactúan. Qué hacen depende de su personalidad, sus
// rasgos y lo que opinan el uno del otro (opinión -100..100 en la `MemoriaNarrativa` de TxNucleo): charla, broma,
// historia junto al fuego, canción, consuelo, insulto, chisme, coqueteo, discusión que acaba en pelea. De ahí salen
// amistades, rivalidades, parejas, celos y nacimientos.

import { recordar } from "./animo.ts";
import { DIALOGOS } from "./datos/dialogos.ts";
import { crearColono, rasgosDe, tiene, tieneRasgo } from "./colonos.ts";
import { nueva } from "./actividades.ts";
import { HZ, dist, type Mundo } from "./mundo.ts";
import type { Colono } from "./tipos.ts";

/** Opinión de `a` sobre `b` (memoria + lo que b despierta por sus rasgos). */
export function opinion(a: Colono, b: Colono): number {
  let base = a.memoria.relacion(b.id);
  for (const r of rasgosDe(b)) base += r.efectos.social?.opinion ?? 0;
  if (a.pareja === b.id) base += 30;
  if (a.padres.includes(b.id) || b.padres.includes(a.id)) base += 20;
  return Math.max(-100, Math.min(100, base));
}

function soc(c: Colono, k: "amabilidad" | "conflicto" | "romance"): number {
  let v = 1;
  for (const r of rasgosDe(c)) v *= r.efectos.social?.[k] ?? 1;
  return v;
}

function decir(m: Mundo, c: Colono, texto: string): void {
  c.dijo = { texto, tick: m.tick };
}

/** Elige una frase del tipo pedido; {x} otro colono, {t} su tribu, {o} otra tribu. */
function frase(m: Mundo, tipo: string, x = "", a?: Colono): string {
  const l = DIALOGOS[tipo] ?? DIALOGOS.saludo;
  const t = a ? m.tribus.get(a.tribu) : undefined;
  const otra = t ? [...m.tribus.values()].find((o) => o !== t && !o.extinta && (t.relaciones[o.id] ?? 0) < 0) ?? [...m.tribus.values()].find((o) => o !== t && !o.extinta) : undefined;
  return l[Math.floor(m.azar.siguiente() * l.length)].replace("{x}", x).replace("{t}", t?.nombre ?? "el pueblo").replace("{o}", otra?.nombre ?? "los de fuera");
}

/** Tema de charla según lo que le pasa al colono y al mundo. */
function temaDeCharla(m: Mundo, a: Colono): string {
  const opciones: string[] = ["saludo"];
  const n = (k: string): number => a.necesidades.valor(k);
  if (m.clima.tipo === "lluvia") opciones.push("lluvia", "lluvia");
  if (m.clima.tipo === "tormenta") opciones.push("tormenta", "tormenta");
  if (m.clima.tipo === "nieve") opciones.push("nieve", "nieve");
  if (a.temperatura < 36) opciones.push("frio", "frio");
  if (a.temperatura > 38) opciones.push("calor");
  opciones.push(m.estacion);
  if (n("hambre") < 40) opciones.push("hambre", "hambre");
  if (n("sed") < 40) opciones.push("sed");
  if (n("energia") < 30) opciones.push("cansado");
  const ultimo = a.stats.ultimoTrabajo;
  const trabajo = ["talar", "minar", "construir", "cazar", "cocinar", "forja"][ultimo ?? -1];
  if (trabajo) opciones.push(trabajo, trabajo);
  const t = m.tribus.get(a.tribu);
  if (t && Object.values(t.relaciones).some((v) => v <= -60)) opciones.push("guerra", "guerra");
  if (t && Object.values(t.relaciones).some((v) => v > 20)) opciones.push("comercio");
  if ([...m.animales.values()].some((b) => b.especie === "lobo" && Math.hypot(b.cuerpo.x - a.x, b.cuerpo.y - a.z) < 40)) opciones.push("lobos");
  const recientes = m.bitacora.slice(-80).filter((e) => e.tribu === a.tribu && m.tick - e.tick < m.ticksDia);
  if (recientes.some((e) => e.tipo === "muerte")) opciones.push("muerte", "muerte");
  if (recientes.some((e) => e.tipo === "nacimiento")) opciones.push("nacimiento", "nacimiento");
  if (recientes.some((e) => e.tipo === "invento" || e.tipo === "era")) opciones.push("invento", "invento");
  if (m.esNoche && m.clima.tipo === "despejado") opciones.push("filosofia");
  if (rasgosDe(a).some((r) => r.id === "filosofo" || r.id === "sonador")) opciones.push("filosofia", "filosofia");
  if (tiene(a, "rebelde") || (t?.lider && a.memoria.relacion(t.lider) < -20)) opciones.push("rebeldia");
  if (t?.lider === a.id) opciones.push("lider");
  return opciones[Math.floor(m.azar.siguiente() * opciones.length)];
}

function interactuar(m: Mundo, a: Colono, b: Colono): void {
  const op = opinion(a, b);
  const pesos: Array<[string, number]> = [];
  const amab = soc(a, "amabilidad"), confl = soc(a, "conflicto");
  pesos.push(["charla", 3 * amab * (1 + a.personalidad.sociable * 0.4)]);
  if (tiene(a, "bromista")) pesos.push(["broma", 2]);
  const puedeActuar = m.tick - (a.stats.ultimaFuncion ?? -1e9) > m.ticksDia * 0.15;
  if (puedeActuar && tiene(a, "narrador") && m.fuegoCerca(a.x, a.z, 5)) pesos.push(["historia", 3]);
  if (puedeActuar && tiene(a, "cantor")) pesos.push(["cancion", 2]);
  if (b.animo < 35) pesos.push(["consuelo", 2.5 * (1 + a.personalidad.empatico)]);
  if (tiene(a, "chismoso")) pesos.push(["chisme", 1.5]);
  const enfriado = m.tick - (a.stats.ultimoInsulto ?? -1e9) > m.ticksDia * 0.25;
  if (enfriado && (op < -5 || confl > 1)) pesos.push(["insulto", Math.min(1.5, Math.max(0, (-op / 40 + 0.06) * confl * (1 + a.personalidad.impulsivo * 0.5)))]);
  const adultos = !m.esNino(a) && !m.esNino(b) && Math.abs(m.edad(a) - m.edad(b)) < 22;
  const libre = (!a.pareja || (tiene(a, "enamoradizo") && !tiene(a, "fiel"))) && (!b.pareja || b.pareja === a.id);
  const calma = m.tick - (a.stats.ultimoRomance ?? -1e9) > m.ticksDia * 1.5;
  if (calma && adultos && a.apariencia.sexo !== b.apariencia.sexo && libre && op > 25 && !tiene(a, "desapegado") && a.pareja !== b.id) pesos.push(["coqueteo", 0.5 * soc(a, "romance") * (op / 50)]);
  const total = pesos.reduce((s, p) => s + Math.max(0, p[1]), 0);
  let r = m.azar.siguiente() * total;
  let tipo = "charla";
  for (const [t, p] of pesos) { r -= Math.max(0, p); if (r <= 0) { tipo = t; break; } }

  a.necesidades.reponer("social", 18);
  b.necesidades.reponer("social", 12);
  switch (tipo) {
    case "charla": {
      decir(m, a, frase(m, temaDeCharla(m, a), b.nombre, a));
      const d = 2 + amab;
      a.memoria.cambiarRelacion(b.id, d * 0.6);
      b.memoria.cambiarRelacion(a.id, d);
      recordar(m, b, "charla", 2, `Charla agradable con ${a.nombre}`, 0.4, a.id);
      break;
    }
    case "broma": {
      decir(m, a, frase(m, "broma", b.nombre, a));
      const sale = m.azar.prob(0.7 - (tieneRasgo(b, "irascible") ? 0.4 : 0));
      b.memoria.cambiarRelacion(a.id, sale ? 4 : -5);
      recordar(m, b, sale ? "charla" : "insultado", sale ? 3 : -3, sale ? `${a.nombre} me hizo reír` : `La broma de ${a.nombre} no tuvo gracia`, 0.5, a.id);
      break;
    }
    case "historia": case "cancion": {
      a.stats.ultimaFuncion = m.tick;
      decir(m, a, frase(m, tipo, b.nombre, a));
      for (const o of m.colonos.values()) {
        if (!o.vivo || o.id === a.id || o.dormido || dist(o, a) > 7) continue;
        o.memoria.cambiarRelacion(a.id, 3);
        o.necesidades.reponer("ocio", 15);
        recordar(m, o, tipo === "historia" ? "historia" : "cancion", 4, tipo === "historia" ? `${a.nombre} contó una gran historia` : `${a.nombre} cantó para nosotros`, 0.6);
      }
      m.emitir(tipo, `${a.nombre} ${tipo === "historia" ? "cuenta una historia junto al fuego" : "canta"}.`, { x: a.x, z: a.z, actores: [a.id], interes: 1, tribu: a.tribu });
      break;
    }
    case "consuelo": {
      decir(m, a, frase(m, "consuelo", b.nombre, a));
      b.memoria.cambiarRelacion(a.id, 8);
      recordar(m, b, "charla", 6, `${a.nombre} me consoló`, 1, a.id);
      break;
    }
    case "chisme": {
      const tercero = [...m.colonos.values()].find((o) => o.vivo && o.id !== a.id && o.id !== b.id && o.tribu === a.tribu);
      if (!tercero) break;
      decir(m, a, frase(m, "chisme", tercero.nombre, a));
      b.memoria.cambiarRelacion(tercero.id, tiene(a, "mentiroso") ? -6 : -3);
      b.memoria.cambiarRelacion(a.id, 1);
      break;
    }
    case "insulto": {
      decir(m, a, frase(m, "insulto", b.nombre, a));
      a.stats.ultimoInsulto = m.tick;
      b.memoria.cambiarRelacion(a.id, -10);
      recordar(m, b, "insultado", -6, `${a.nombre} me insultó`, 1, a.id);
      m.emitir("insulto", `${a.nombre} insulta a ${b.nombre}.`, { x: a.x, z: a.z, actores: [a.id, b.id], interes: 2, tribu: a.tribu });
      // Discusión que escala a pelea.
      const furia = opinion(b, a) < -45 && (b.personalidad.impulsivo > 0 || tieneRasgo(b, "irascible") || tiene(b, "rencoroso")) && !tiene(b, "pacifista");
      if (furia && m.azar.prob(0.5)) {
        b.actividad = nueva(m, "pelear", { x: a.x, z: a.z, alcance: 1.3 }, { objetivo: a.id });
        b.dormido = false;
        m.emitir("pelea", `${b.nombre} se lanza a golpes contra ${a.nombre}.`, { x: b.x, z: b.z, actores: [b.id, a.id], interes: 3, tribu: b.tribu });
      }
      break;
    }
    case "coqueteo": {
      decir(m, a, frase(m, "amor", b.nombre, a));
      const acepta = opinion(b, a) > 35 && m.azar.prob(0.25 * soc(b, "romance")) && !tiene(b, "desapegado") && (!b.pareja || b.pareja === a.id);
      if (acepta && a.pareja !== b.id) {
        if (a.pareja) romper(m, a);
        a.stats.ultimoRomance = b.stats.ultimoRomance = m.tick;
        a.pareja = b.id;
        b.pareja = a.id;
        a.memoria.cambiarRelacion(b.id, 20);
        b.memoria.cambiarRelacion(a.id, 20);
        recordar(m, a, "pareja", 12, `Estoy con ${b.nombre}`, 3, b.id);
        recordar(m, b, "pareja", 12, `Estoy con ${a.nombre}`, 3, a.id);
        m.emitir("pareja", `${a.nombre} y ${b.nombre} se hacen pareja.`, { x: a.x, z: a.z, actores: [a.id, b.id], interes: 3, tribu: a.tribu });
        // Celos de una ex pareja o de quien también la quería.
        for (const o of m.colonos.values()) {
          if (o.vivo && o.id !== a.id && o.id !== b.id && tiene(o, "celoso") && opinion(o, b) > 50) {
            o.memoria.cambiarRelacion(a.id, -25);
            recordar(m, o, "rechazo", -8, `${b.nombre} eligió a ${a.nombre}`, 2, a.id);
          }
        }
      } else if (!acepta) {
        b.memoria.cambiarRelacion(a.id, -1);
        recordar(m, a, "rechazo", -3, `${b.nombre} me rechazó`, 0.7, b.id);
      }
      break;
    }
  }
}

function romper(m: Mundo, a: Colono): void {
  const b = a.pareja ? m.colonos.get(a.pareja) : undefined;
  a.pareja = null;
  if (b) {
    b.pareja = null;
    b.memoria.cambiarRelacion(a.id, -30);
    recordar(m, b, "ruptura", -12, `${a.nombre} me dejó`, 3, a.id);
    m.emitir("ruptura", `${a.nombre} y ${b.nombre} rompen.`, { x: a.x, z: a.z, actores: [a.id, b.id], interes: 2, tribu: a.tribu });
  }
}

function parir(m: Mundo, a: Colono): void {
  const padreId = String(a.memoria.obtener("embarazo_padre") ?? "");
  delete a.stats.embarazoDesde;
  a.stats.ultimoParto = m.tick;
  const b = m.colonos.get(padreId);
  const t = m.tribus.get(a.tribu);
  if (!t) return;
  const padres = b ? [a, b] : [a];
  const bebe = crearColono(m, { tribu: t.id, x: a.x, z: a.z, edad: 0, padres });
  // Gemelos (raro).
  if (m.azar.prob(0.04)) {
    const otro = crearColono(m, { tribu: t.id, x: a.x + 0.3, z: a.z, edad: 0, padres });
    m.emitir("nacimiento", `¡Gemelos! Nace también ${otro.nombre}.`, { x: a.x, z: a.z, actores: [otro.id, a.id], interes: 3, tribu: t.id });
  }
  for (const o of m.miembros(t.id)) recordar(m, o, "nacimiento", o.id === a.id || o.id === b?.id ? 15 : 4, `Nació ${bebe.nombre}`, 2, bebe.id);
  m.emitir("nacimiento", `¡Nace ${bebe.nombre}, hijo de ${a.nombre}${b ? ` y ${b.nombre}` : ""} (${t.nombre})!`, { x: a.x, z: a.z, actores: [bebe.id, a.id, ...(b ? [b.id] : [])], interes: 3, tribu: t.id });
}

/** Sistema social: interacciones por cercanía y nacimientos. */
export function sistemaSocial(m: Mundo, _dt: number): void {
  for (const a of m.colonos.values()) {
    if (!a.vivo || a.dormido || a.derribado || a.crisis || m.tick < a.proximoSocial) continue;
    a.proximoSocial = m.tick + Math.round(HZ * m.azar.rango(8, 16) * (tiene(a, "ermitano") ? 2.5 : 1) / (1 + Math.max(0, a.personalidad.sociable) * 0.6));
    let b: Colono | null = null, md = 5;
    for (const o of m.colonos.values()) {
      if (!o.vivo || o.id === a.id || o.dormido || o.derribado) continue;
      const d = dist(o, a);
      if (d < md) { md = d; b = o; }
    }
    if (b && (b.tribu === a.tribu || m.azar.prob(0.3))) interactuar(m, a, b);
  }
  // Embarazos (una vez por hora de juego): parejas adultas de la misma tribu, con comida y techo.
  if (m.tick % Math.round(m.ticksDia / 24) === 0) {
    for (const a of m.colonos.values()) {
      if (!a.vivo || a.apariencia.sexo !== "f") continue;
      // Partos: 9 meses después de quedar embarazada.
      if (a.stats.embarazoDesde !== undefined) {
        if (m.tick - a.stats.embarazoDesde >= m.ticksDia * m.config.diasPorMes * 9) parir(m, a);
        continue;
      }
      if (!a.pareja || a.derribado) continue;
      const b = m.colonos.get(a.pareja);
      if (!b || !b.vivo || b.tribu !== a.tribu || m.edad(a) > 44 || m.edad(a) < 17 || m.edad(b) < 17) continue;
      const t = m.tribus.get(a.tribu);
      if (!t) continue;
      const pob = m.miembros(t.id).length;
      if (pob >= m.capacidad(t) || (a.stats.ultimoParto ?? -Infinity) > m.tick - m.ticksAnio) continue;
      const camas = [...m.estructuras.values()].filter((e) => e.tribu === t.id && e.progreso >= 1).reduce((s2, e) => s2 + (e.ocupantes.length ? 0 : 0) + (e.tipo === "choza" ? 2 : e.tipo === "cabana" ? 3 : e.tipo === "casa" ? 4 : e.tipo === "casa_grande" ? 8 : e.tipo === "enfermeria" ? 3 : 0), 0);
      const comida = Object.entries(t.almacen).reduce((s2, [o, n]) => s2 + (o.includes("carne") || o === "bayas" || o === "verdura" || o === "guiso" || o === "pan_raices" ? n : 0), 0);
      const prob = 0.008 * (camas > pob ? 1.3 : 0.6) * (comida > pob * 4 ? 1.2 : 0.4);
      if (!m.azar.prob(prob)) continue;
      a.stats.embarazoDesde = m.tick;
      a.memoria.fijar("embarazo_padre", b.id);
      recordar(m, a, "pareja", 10, "Voy a ser madre", 3);
      recordar(m, b, "pareja", 10, "Voy a ser padre", 3);
      m.emitir("embarazo", `${a.nombre} y ${b.nombre} esperan un hijo.`, { x: a.x, z: a.z, actores: [a.id, b.id], interes: 2, tribu: t.id });
    }
  }
}
