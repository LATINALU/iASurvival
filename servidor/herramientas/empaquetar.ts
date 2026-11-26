// Empaqueta el motor del juego para que el .exe de Godot lo arranque solo, sin instalar nada:
//   build/iASurvival/motor/servidor.mjs   ← servidor + TxNucleo + ws en un solo archivo (esbuild quita los tipos)
//   build/iASurvival/motor/node.exe       ← copia del node con el que se ejecuta este script
//   build/iASurvival/motor/ias_nativo.wasm ← núcleo nativo (Rust → WebAssembly)
//   build/iASurvival/motor/API.md         ← guía de la API (para cuando se abran las IAs externas)
// Uso: node herramientas/empaquetar.ts

import { build } from "esbuild";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destino = resolve(raiz, process.env.IASURVIVAL_DESTINO ?? "../build/iASurvival/motor");
await mkdir(destino, { recursive: true });

await build({
  entryPoints: [join(raiz, "src/principal.ts")],
  outfile: join(destino, "servidor.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // `ws` tiene dependencias opcionales nativas que no hacen falta.
  external: ["bufferutil", "utf-8-validate"],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});
await copyFile(process.execPath, join(destino, "node.exe"));
await copyFile(resolve(raiz, "../docs/API.md"), join(destino, "API.md"));
// Núcleo nativo en Rust (WebAssembly): terreno y caminos rápidos. Sin él, el motor usa la versión en TypeScript.
await copyFile(resolve(raiz, "nativo/ias_nativo.wasm"), join(destino, "ias_nativo.wasm"));
const t = (await stat(join(destino, "servidor.mjs"))).size;
console.log(`motor empaquetado en ${destino} (servidor.mjs ${(t / 1024).toFixed(0)} KB + node.exe)`);
