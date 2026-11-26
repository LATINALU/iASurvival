// Orden de los sistemas en cada tick. Un solo lugar para que el servidor, la simulación sin interfaz y los tests
// avancen el mundo exactamente igual.

import { sistemaActividades } from "./actividades.ts";
import { sistemaAnimo } from "./animo.ts";
import { sistemaClima } from "./clima.ts";
import { sistemaCuerpos } from "./colonos.ts";
import { sistemaFauna } from "./fauna.ts";
import { sistemaFisica, sistemaProyectiles } from "./fisica.ts";
import type { Mundo } from "./mundo.ts";
import { sistemaNarrador } from "./narrador.ts";
import { sistemaPlanificador } from "./planificador.ts";
import { sistemaSocial } from "./social.ts";
import { sistemaTribus } from "./tribus.ts";
import { sistemaTecnologia } from "./tecnologia.ts";

export const SISTEMAS: ReadonlyArray<(m: Mundo, dt: number) => void> = [
  sistemaClima, sistemaCuerpos, sistemaAnimo, sistemaPlanificador, sistemaActividades, sistemaFisica, sistemaProyectiles, sistemaSocial, sistemaFauna, sistemaTribus, sistemaTecnologia, sistemaNarrador,
];

export function avanzar(m: Mundo, ticks = 1): void {
  for (let i = 0; i < ticks; i++) m.paso(SISTEMAS);
}
