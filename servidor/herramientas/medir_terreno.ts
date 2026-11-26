// Proporciones del terreno (montaña, agua, biomas) para varias semillas. Uso: node herramientas/medir_terreno.ts [--tam 768]
import { BIOMAS, generarTerreno } from "../src/dominio/terreno.ts";
const i = process.argv.indexOf("--tam");
const tam = i >= 0 ? Number(process.argv[i + 1]) : 768;
for (const s of [1, 5, 9]) {
  const t0 = performance.now();
  const t = generarTerreno(s, tam);
  let alto = 0, agua = 0;
  for (let k = 0; k < t.alturas.length; k++) { if (t.alturas[k] > 2.03) alto++; if (t.biomas[k] === 0) agua++; }
  const n = t.alturas.length;
  console.log(`semilla ${s}: montaña ${(alto / n * 100).toFixed(1)} % · agua ${(agua / n * 100).toFixed(1)} % · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
void BIOMAS;
