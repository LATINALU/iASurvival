// Comprueba que de cualquier casa (en 16 orientaciones) se puede salir y entrar caminando.
// Uso: node herramientas/prueba_puertas.ts
import { generarMundo } from "../src/dominio/tribus.ts";
import { CONFIG_POR_DEFECTO } from "../src/dominio/tipos.ts";

const m = generarMundo({ ...CONFIG_POR_DEFECTO, semilla: 3, tribus: 1, colonosPorTribu: 2 });
const t = [...m.tribus.values()][0];
let fallos = 0, total = 0;
for (const tipo of ["choza", "cabana", "casa", "casa_grande", "granero"]) {
  for (let k = 0; k < 16; k++) {
    const rot = (Math.PI * 2 * k) / 16;
    const x = t.centro.x + 0.37, z = t.centro.z + 0.61;
    m.estructuras.clear();
    m.estructuras.set("e", { id: "e", tipo, tribu: t.id, x, z, rot, progreso: 1, entregado: {}, vida: 100, combustible: 0, cultivo: 0, ocupantes: [] });
    m.recalcularTrazado();
    total++;
    const sale = m.camino(x, z, x + 12, z + 9);
    const entra = m.camino(x + 12, z + 9, x, z);
    if (!sale || !entra) { fallos++; console.log("ENCERRADO", tipo, k); }
  }
}
console.log(`${total - fallos}/${total} casas con salida`);
