// Diagnóstico de muertes de frío: guarda el estado de cada colono cuando su temperatura baja de 34.5 °C y lo
// imprime si muere de frío. Uso: node herramientas/diag_frio.ts --dias 24 --semilla 7
import { avanzar } from "../src/dominio/simulacion.ts";
import { generarMundo } from "../src/dominio/tribus.ts";
import { CONFIG_POR_DEFECTO } from "../src/dominio/tipos.ts";
import { aguaCerca, aguaMasCercana } from "../src/dominio/terreno.ts";

const arg = (n: string, d: number): number => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? Number(process.argv[i + 1]) : d; };
const m = generarMundo({ ...CONFIG_POR_DEFECTO, semilla: arg("semilla", 7), tribus: arg("tribus", 1), colonosPorTribu: arg("colonos", 8) });
const ultimo = new Map<string, string>();
const total = Math.round(arg("dias", 24) * m.ticksDia);
const causaBuscada = process.argv.includes("--sed") ? "sed" : process.argv.includes("--hambre") ? "hambre" : "frio";
const resumen: Record<string, number> = {};
for (let t = 0; t < total; t++) {
  avanzar(m);
  if (t % 5 === 0) for (const c of m.colonos.values()) {
    if (!c.vivo || (causaBuscada === "frio" ? c.temperatura > 34.5 : c.necesidades.valor(causaBuscada) > 12)) continue;
    const f = m.fuegoCerca(c.x, c.z, 60);
    const cama = c.cama ? m.estructuras.get(c.cama) : undefined;
    const t2 = m.tribus.get(c.tribu);
    ultimo.set(c.id, `${m.fecha} ${m.hora} T=${c.temperatura.toFixed(1)} amb=${m.temperaturaEn(c.x, c.z).toFixed(1)} act=${c.actividad?.tipo ?? "-"} dormido=${c.dormido} derribado=${c.derribado} cama=${cama ? cama.tipo + (cama.progreso < 1 ? "(obra)" : "") : "no"} fuego=${f ? Math.hypot(f.x - c.x, f.z - c.z).toFixed(0) + "m" : "no"} centro=${t2 ? Math.hypot(t2.centro.x - c.x, t2.centro.z - c.z).toFixed(0) : "?"}m ropa=${c.equipo.ropa ?? "-"} comidaTribu=${Object.entries(t2?.almacen ?? {}).filter(([o]) => /bayas|verdura|carne|guiso|pan/.test(o)).reduce((s2, [, n]) => s2 + n, 0)} carga=${JSON.stringify(c.carga)} dest=${c.actividad?.destino ? Math.hypot(c.actividad.destino.x - c.x, c.actividad.destino.z - c.z).toFixed(1) + "/" + c.actividad.destino.alcance.toFixed(2) : "-"} camino=${c.actividad?.camino.length ?? 0} asiento=${c.actividad?.datos.asiento ?? "-"} refugio=${m.refugioEn(c.x, c.z)?.tipo ?? "no"} fogatas=${[...m.estructuras.values()].filter((e) => e.tribu === c.tribu && e.tipo === "fogata").map((e) => Math.round(e.combustible)).join("/")} madera=${Math.round(t2?.almacen.madera ?? 0)} edad=${Math.floor(m.edad(c))} hambre=${c.necesidades.valor("hambre").toFixed(0)} sed=${c.necesidades.valor("sed").toFixed(0)} pos=${c.x.toFixed(1)},${c.z.toFixed(1)} agua=${(() => { const a = aguaMasCercana(m.terreno, c.x, c.z, 60); return a ? a.distancia.toFixed(1) : "no"; })()} aguaCerca=${aguaCerca(m.terreno, c.x, c.z)} crisis=${c.crisis?.tipo ?? "-"}`);
  }
  for (const e of m.sacarPendientes()) {
    if (e.tipo !== "muerte") continue;
    const causa = String(e.datos?.causa ?? "?");
    resumen[causa] = (resumen[causa] ?? 0) + 1;
    if (causa === causaBuscada) console.log(causaBuscada.toUpperCase() + ":", e.texto, "\n   ", ultimo.get(e.actores[0]) ?? "(sin registro)");
  }
}
console.log("muertes", resumen, "vivos", m.vivos().length);
