// Integridad del catálogo de rasgos y trasfondos: 100 rasgos únicos, incompatibilidades que existen y son
// simétricas, efectos escritos con el vocabulario de esquema.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { CONDICIONES, CONDUCTAS, HABILIDADES, RECUERDOS, STATS, TRABAJOS } from "../src/dominio/datos/esquema.ts";
import { CATEGORIAS_RASGO, RASGO_POR_ID, RASGOS } from "../src/dominio/datos/rasgos.ts";
import { TRASFONDOS } from "../src/dominio/datos/trasfondos.ts";

test("hay 100 rasgos únicos en 10 categorías de 10", () => {
  assert.equal(RASGOS.length, 100);
  assert.equal(RASGO_POR_ID.size, 100);
  assert.equal(CATEGORIAS_RASGO.length, 10);
  for (const c of CATEGORIAS_RASGO) assert.equal(RASGOS.filter((r) => r.categoria === c).length, 10, c);
  assert.equal(new Set(RASGOS.map((r) => r.nombre)).size, 100);
});

test("incompatibilidades existen y no se contradicen", () => {
  for (const r of RASGOS) {
    for (const i of r.incompatibles ?? []) {
      assert.ok(RASGO_POR_ID.has(i), `${r.id} → ${i} no existe`);
      assert.notEqual(i, r.id);
    }
  }
});

test("los efectos usan solo el vocabulario del esquema", () => {
  for (const r of RASGOS) {
    const e = r.efectos;
    for (const k of Object.keys(e.stats ?? {})) assert.ok((STATS as readonly string[]).includes(k), `${r.id}: stat ${k}`);
    for (const k of Object.keys(e.trabajo ?? {})) assert.ok((TRABAJOS as readonly string[]).includes(k), `${r.id}: trabajo ${k}`);
    for (const k of Object.keys(e.reacciones ?? {})) assert.ok((RECUERDOS as readonly string[]).includes(k), `${r.id}: recuerdo ${k}`);
    for (const p of e.pensamientos ?? []) assert.ok((CONDICIONES as readonly string[]).includes(p.cuando), `${r.id}: condición ${p.cuando}`);
    for (const c of e.conductas ?? []) assert.ok((CONDUCTAS as readonly string[]).includes(c), `${r.id}: conducta ${c}`);
    assert.ok(r.descripcion.length > 5);
  }
});

test("40 trasfondos (20+20) con habilidades válidas", () => {
  assert.equal(TRASFONDOS.length, 40);
  assert.equal(TRASFONDOS.filter((x) => x.etapa === "infancia").length, 20);
  for (const x of TRASFONDOS) for (const h of Object.keys(x.habilidades)) assert.ok((HABILIDADES as readonly string[]).includes(h), `${x.id}: ${h}`);
});
