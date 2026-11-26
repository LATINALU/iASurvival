// Compara el núcleo nativo (Rust/WASM) con la versión TypeScript: mismo terreno y caminos equivalentes, y la
// velocidad de cada uno. Uso: node herramientas/comparar_nativo.ts
import { spawnSync } from "node:child_process";
const codigo = `
import { generarTerreno } from "./src/dominio/terreno.ts";
import { generarMundo } from "./src/dominio/tribus.ts";
import { CONFIG_POR_DEFECTO } from "./src/dominio/tipos.ts";
import { nativoDisponible } from "./src/dominio/nativo.ts";
let t0 = performance.now();
const t = generarTerreno(5, 768);
const ter = performance.now() - t0;
let h = 0; for (let i = 0; i < t.alturas.length; i += 97) h = (h * 31 + Math.round(t.alturas[i] * 100) + t.biomas[i]) >>> 0;
const m = generarMundo({ ...CONFIG_POR_DEFECTO, tam: 768, semilla: 5, tribus: 1, colonosPorTribu: 2 });
let largo = 0, nulos = 0; t0 = performance.now();
for (let k = 0; k < 300; k++) {
  const a = m.lugarLibre({}), b = m.lugarLibre({ cerca: a, radio: 70 });
  const r = m.camino(a.x, a.z, b.x, b.z);
  if (r) largo += r.length; else nulos++;
}
const cam = performance.now() - t0;
console.log(JSON.stringify({ nativo: nativoDisponible(), terreno_ms: Math.round(ter), huella: h, caminos_ms: Math.round(cam), puntos: largo, nulos }));
`;
for (const sin of ["0", "1"]) {
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", codigo], { env: { ...process.env, IASURVIVAL_SIN_NATIVO: sin }, encoding: "utf8" });
  console.log(sin === "1" ? "TypeScript:" : "Rust/WASM: ", r.stdout.trim() || r.stderr.trim().split("\n").slice(-3).join(" "));
}
