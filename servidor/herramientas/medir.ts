// Mide el mundo: tiempo de generación, nodos por tipo, % de agua y llano, ms por tick y tamaño del inicio.
// Uso: node herramientas/medir.ts [--tam 1536] [--tribus 6] [--ticks 300]
import { generarMundo } from "../src/dominio/tribus.ts";
import { avanzar } from "../src/dominio/simulacion.ts";
import { CONFIG_POR_DEFECTO } from "../src/dominio/tipos.ts";
import { vistaTerreno } from "../src/dominio/vista.ts";
import { codificarInicio } from "../src/dominio/inicio_binario.ts";
import { BIOMAS } from "../src/dominio/terreno.ts";

const arg = (n: string, d: number): number => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? Number(process.argv[i + 1]) : d; };
let t0 = performance.now();
const m = generarMundo({ ...CONFIG_POR_DEFECTO, tam: arg("tam", CONFIG_POR_DEFECTO.tam), semilla: arg("semilla", 5), tribus: arg("tribus", 6), colonosPorTribu: 8 });
const gen = performance.now() - t0;
const porTipo: Record<string, number> = {};
for (const n of m.nodos.values()) porTipo[n.tipo] = (porTipo[n.tipo] ?? 0) + 1;
const porBioma: Record<string, number> = {};
for (const b of m.terreno.biomas) porBioma[BIOMAS[b]] = (porBioma[BIOMAS[b]] ?? 0) + 1;
const total = m.terreno.biomas.length;
const pct = Object.fromEntries(Object.entries(porBioma).map(([k, v]) => [k, Math.round((v / total) * 1000) / 10]));
const empinado = (() => { let n = 0; const a = m.terreno.alturas; for (let i = 0; i < a.length; i++) if (a[i] > 2.03) n++; return Math.round((n / a.length) * 1000) / 10; })();
t0 = performance.now();
const ticks = arg("ticks", 300);
avanzar(m, ticks);
const tick = (performance.now() - t0) / ticks;
const binario = codificarInicio(m).length;
const json = JSON.stringify(vistaTerreno(m)).length;
console.log(JSON.stringify({ tam: m.config.tam, gen_s: Math.round(gen / 100) / 10, nodos: m.nodos.size, porTipo, montaña_pct: empinado, biomas_pct: pct, tribus: m.tribus.size, colonos: m.vivos().length, ms_por_tick: Number(tick.toFixed(2)), kb_inicio: Math.round(binario / 1024), kb_json_crudo: Math.round(json / 1024) }, null, 1));
