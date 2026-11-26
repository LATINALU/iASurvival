// Perfil de la simulación avanzada: genera, calienta N días y mide ms/tick en los siguientes ticks.
// Uso: node --cpu-prof herramientas/perfil.ts --tribus 6 --colonos 10 --dias 3 --ticks 3000
import { generarMundo } from "../src/dominio/tribus.ts";
import { avanzar } from "../src/dominio/simulacion.ts";
import { CONFIG_POR_DEFECTO } from "../src/dominio/tipos.ts";
const arg = (n: string, d: number): number => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const m = generarMundo({ ...CONFIG_POR_DEFECTO, semilla: arg("semilla", 7), tribus: arg("tribus", 6), colonosPorTribu: arg("colonos", 10) });
avanzar(m, Math.round(m.ticksDia * arg("dias", 3)));
const t0 = performance.now();
const n = arg("ticks", 3000);
avanzar(m, n);
console.log(JSON.stringify({ colonos: m.vivos().length, animales: m.animales.size, estructuras: m.estructuras.size, tareas: m.tareas.size, ms_por_tick: Number(((performance.now() - t0) / n).toFixed(2)) }));
