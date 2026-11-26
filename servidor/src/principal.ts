// Arranque del bosque 24/7: carga el último guardado (o crea uno nuevo), corre la simulación a 5 Hz con el
// `BucleFijo` de TxNucleo, sirve la API HTTP y el canal del observador, escribe la bitácora y guarda cada 60 s.
// Uso: node src/principal.ts [--puerto 8787] [--datos ./datos] [--velocidad 1] [--nuevo]
// Entorno: IASURVIVAL_PUERTO, IASURVIVAL_SEMILLA, IASURVIVAL_SEGUNDOS_POR_DIA, IASURVIVAL_OBSERVADOR (token).

import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { motor } from "txnucleo";
import { ServicioMundo } from "./aplicacion/servicio.ts";
import { HZ } from "./dominio/mundo.ts";
import { generarMundo } from "./dominio/tribus.ts";
import { nativoDisponible } from "./dominio/nativo.ts";
import { TICKS_ENTRE_GUARDADOS } from "./dominio/serializacion.ts";
import { CONFIG_POR_DEFECTO } from "./dominio/tipos.ts";
import { crearServidorHttp } from "./infraestructura/http.ts";
import { Observadores } from "./infraestructura/observador.ts";
import { configDesdeEntorno, Disco } from "./infraestructura/persistencia.ts";

const aqui = dirname(fileURLToPath(import.meta.url));

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export interface OpcionesArranque {
  puerto: number;
  datos: string;
  velocidad: number;
  nuevo: boolean;
  docs?: string;
  semilla?: number;
  tribus?: number;
  /** Lado del mapa en metros (576, 1152 o 1536). */
  tam?: number;
  colonos?: number;
  /** Proceso padre (el visor): si muere, el servidor guarda y se cierra. */
  padre?: number;
}

export async function arrancar(op: OpcionesArranque) {
  const disco = new Disco(op.datos);
  const cargado = op.nuevo ? { mundo: null } : await disco.cargar();
  if ("aviso" in cargado && cargado.aviso) console.warn(cargado.aviso);
  const base = configDesdeEntorno(CONFIG_POR_DEFECTO);
  const mundo = cargado.mundo ?? generarMundo({ ...base, tam: op.tam ?? base.tam, semilla: op.semilla ?? base.semilla, tribus: op.tribus ?? base.tribus, colonosPorTribu: op.colonos ?? base.colonosPorTribu });
  const servicio = new ServicioMundo(mundo);
  const obtener = () => servicio;

  const http = crearServidorHttp(obtener, { docs: op.docs ?? resolve(aqui, "../../docs/API.md") });
  const observadores = new Observadores(http, obtener);

  let guardando = false;
  const guardar = async (): Promise<void> => {
    if (guardando) return;
    guardando = true;
    try {
      await disco.guardar(servicio.mundo);
    } catch (e) {
      console.error("no se pudo guardar:", e);
    } finally {
      guardando = false;
    }
  };

  let colaBitacora: Promise<void> = Promise.resolve();
  const bucle = new motor.BucleFijo({
    actualizar: () => {
      servicio.paso();
      const eventos = servicio.mundo.sacarPendientes();
      if (eventos.length) {
        colaBitacora = colaBitacora.then(() => disco.bitacora(eventos)).catch((e) => console.error("bitácora:", e));
        for (const e of eventos) if (e.interes >= 2) console.log(`[día ${e.dia} ${e.hora}] ${e.texto}`);
      }
      observadores.difundir(eventos);
      if (servicio.mundo.tick % TICKS_ENTRE_GUARDADOS === 0) void guardar();
    },
  }, { hz: HZ, topeDt: Math.max(0.25, op.velocidad * 0.25), maxPasos: Math.max(8, Math.ceil(op.velocidad * 4)) });
  bucle.escalaTiempo = op.velocidad;
  const reloj = setInterval(() => bucle.avanzar(performance.now() / 1000), 50);
  const fijarVelocidad = (v: number): void => {
    bucle.escalaTiempo = Math.max(0, Math.min(128, v));
    (bucle as unknown as { topeDt: number }).topeDt = Math.max(0.25, bucle.escalaTiempo * 0.25);
    (bucle as unknown as { maxPasos: number }).maxPasos = Math.max(8, Math.ceil(bucle.escalaTiempo * 4));
  };
  observadores.alComando = async (c) => {
    switch (c.tipo) {
      case "velocidad":
        fijarVelocidad(Number(c.valor));
        return { ok: true, velocidad: bucle.escalaTiempo };
      case "guardar":
        await guardar();
        return { ok: true };
      case "salir":
        setTimeout(async () => { await cerrar(); process.exit(0); }, 10);
        return { ok: true };
      default:
        return servicio.comando(c);
    }
  };
  observadores.velocidad = () => bucle.escalaTiempo;

  await new Promise<void>((ok) => http.listen(op.puerto, ok));
  const puerto = (http.address() as { port: number }).port;
  console.log(`iASurvival: mundo ${cargado.mundo ? "cargado" : "nuevo"} de ${mundo.config.tam} m (dia ${mundo.ciclo.dia}, ${mundo.hora}, ${mundo.tribus.size} tribus, ${mundo.vivos().length} colonos) · núcleo nativo: ${nativoDisponible() ? "Rust/WASM" : "TypeScript"}`);
  console.log(`  API:        http://localhost:${puerto}/api/docs`);
  console.log(`  Observador: ws://localhost:${puerto}/observador${process.env.IASURVIVAL_OBSERVADOR ? "?token=…" : " (solo localhost)"}`);
  console.log(`IASURVIVAL_LISTO ${puerto}`);
  let vigia: ReturnType<typeof setInterval> | undefined;
  if (op.padre) {
    vigia = setInterval(() => {
      try {
        process.kill(op.padre!, 0);
      } catch {
        console.log("El visor se cerró: guardando y saliendo.");
        void cerrar().then(() => process.exit(0));
      }
    }, 2000);
  }

  let cerrado = false;
  async function cerrar(): Promise<void> {
    if (cerrado) return;
    cerrado = true;
    clearInterval(reloj);
    if (vigia) clearInterval(vigia);
    observadores.cerrar();
    http.close();
    const pendientes = servicio.mundo.sacarPendientes();
    await colaBitacora;
    if (pendientes.length) await disco.bitacora(pendientes);
    await guardar();
  }
  return { servicio, http, cerrar, fijarVelocidad };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const vivo = await arrancar({
    puerto: Number(arg("puerto") ?? process.env.IASURVIVAL_PUERTO ?? 8787),
    datos: resolve(arg("datos") ?? join(aqui, "../datos")),
    velocidad: Number(arg("velocidad") ?? 1),
    nuevo: process.argv.includes("--nuevo"),
    docs: arg("docs"),
    semilla: arg("semilla") ? Number(arg("semilla")) : undefined,
    tribus: arg("tribus") ? Number(arg("tribus")) : undefined,
    tam: arg("tam") ? Math.max(256, Math.min(2048, Number(arg("tam")))) : undefined,
    colonos: arg("colonos") ? Number(arg("colonos")) : undefined,
    padre: arg("padre") ? Number(arg("padre")) : undefined,
  });
  const salir = async () => {
    console.log("Guardando el bosque…");
    await vivo.cerrar();
    process.exit(0);
  };
  process.on("SIGINT", salir);
  process.on("SIGTERM", salir);
}
