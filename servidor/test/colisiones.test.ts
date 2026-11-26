import { test } from "node:test";
import assert from "node:assert/strict";
import { generarMundo } from "../src/dominio/tribus.ts";
import { CONFIG_POR_DEFECTO } from "../src/dominio/tipos.ts";

test("de toda casa se puede salir y entrar, en cualquier orientación", () => {
  const m = generarMundo({ ...CONFIG_POR_DEFECTO, semilla: 3, tribus: 1, colonosPorTribu: 2 });
  const t = [...m.tribus.values()][0];
  for (const tipo of ["choza", "cabana", "casa", "casa_grande", "granero"]) {
    for (let k = 0; k < 16; k++) {
      const x = t.centro.x + 0.37, z = t.centro.z + 0.61;
      m.estructuras.clear();
      m.estructuras.set("e", { id: "e", tipo, tribu: t.id, x, z, rot: (Math.PI * 2 * k) / 16, progreso: 1, entregado: {}, vida: 100, combustible: 0, cultivo: 0, ocupantes: [] });
      m.recalcularTrazado();
      assert.ok(m.camino(x, z, x + 12, z + 9), `${tipo} ${k}: no se puede salir`);
      assert.ok(m.camino(x + 12, z + 9, x, z), `${tipo} ${k}: no se puede entrar`);
    }
  }
});

test("las paredes de una casa terminada no se atraviesan", () => {
  const m = generarMundo({ ...CONFIG_POR_DEFECTO, semilla: 3, tribus: 1, colonosPorTribu: 2 });
  const t = [...m.tribus.values()][0];
  const x = t.centro.x + 0.5, z = t.centro.z + 0.5;
  m.estructuras.clear();
  m.estructuras.set("e", { id: "e", tipo: "casa", tribu: t.id, x, z, rot: 0, progreso: 1, entregado: {}, vida: 100, combustible: 0, cultivo: 0, ocupantes: [] });
  m.recalcularTrazado();
  // Pared trasera (z local negativo) bloqueada; puerta delantera libre.
  assert.equal(m.pisable(x, z - 1.95), false);
  assert.equal(m.pisable(x, z + 1.95), true);
});
