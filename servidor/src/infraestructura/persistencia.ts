// Guardado del bosque en disco: foto del mundo cada 60 s con el `Guardado` versionado de TxNucleo (suma de
// control + respaldo rotado) sobre `AlmacenArchivos` (escritura atómica), credenciales aparte, y la bitácora
// completa como JSONL (una línea por suceso) para revisar la historia después.

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { persistencia } from "txnucleo";
import { AlmacenArchivos } from "txnucleo/archivos";
import type { Mundo } from "../dominio/mundo.ts";
import { esFoto, exportarMundo, importarMundo, VERSION_GUARDADO, type FotoMundo } from "../dominio/serializacion.ts";
import type { ConfigMundo, EventoMundo } from "../dominio/tipos.ts";

export class Disco {
  readonly carpeta: string;
  private readonly mundo: persistencia.Guardado<FotoMundo | null>;

  constructor(carpeta: string) {
    this.carpeta = carpeta;
    const almacen = new AlmacenArchivos(carpeta);
    this.mundo = new persistencia.Guardado<FotoMundo | null>(almacen, { version: VERSION_GUARDADO, porDefecto: () => null, validar: (d): d is FotoMundo | null => d === null || esFoto(d) });
    this.mundo.ranura = "mundo";
  }

  /** Carga el mundo guardado o devuelve null (y avisa si el archivo estaba roto). */
  async cargar(): Promise<{ mundo: Mundo | null; aviso?: string }> {
    const m = await this.mundo.cargar();
    const aviso = m.estado === "apartado" ? `guardado del mundo apartado (${m.motivo}); se empieza un mundo nuevo` : undefined;
    return { mundo: m.datos ? importarMundo(m.datos) : null, aviso };
  }

  async guardar(m: Mundo): Promise<void> {
    await this.mundo.guardar(exportarMundo(m));
  }

  async bitacora(eventos: readonly EventoMundo[]): Promise<void> {
    if (!eventos.length) return;
    await mkdir(this.carpeta, { recursive: true });
    await appendFile(join(this.carpeta, "bitacora.jsonl"), eventos.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
  }
}

/** Configuración desde variables de entorno (IASURVIVAL_*). */
export function configDesdeEntorno(base: ConfigMundo): ConfigMundo {
  const n = (k: string, d: number): number => {
    const v = Number(process.env[`IASURVIVAL_${k}`]);
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return { ...base, semilla: n("SEMILLA", base.semilla), segundosPorDia: n("SEGUNDOS_POR_DIA", base.segundosPorDia) };
}
