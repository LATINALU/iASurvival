// Vocabulario común de los colonos: estadísticas, trabajos, habilidades, conductas y condiciones de pensamiento.
// Los rasgos (rasgos.ts) y trasfondos (trasfondos.ts) son DATOS escritos con este vocabulario; la simulación lo lee.

export const STATS = [
  "velocidad", "trabajo", "fuerza", "defensa", "apetito", "sueno", "dolor", "aprendizaje", "curacion", "carisma", "sigilo", "vision",
] as const;
export type Stat = (typeof STATS)[number];

export const TRABAJOS = ["talar", "minar", "recolectar", "cazar", "cocinar", "construir", "cultivar", "curar", "vigilar", "fabricar", "comerciar", "pelear", "investigar"] as const;
export type Trabajo = (typeof TRABAJOS)[number];

export const HABILIDADES = ["tala", "mineria", "recoleccion", "caza", "cocina", "construccion", "cultivo", "medicina", "combate", "artesania", "social", "saber"] as const;
export type Habilidad = (typeof HABILIDADES)[number];

/** Qué habilidad usa cada trabajo. */
export const HABILIDAD_DE: Readonly<Record<Trabajo, Habilidad>> = {
  talar: "tala", minar: "mineria", recolectar: "recoleccion", cazar: "caza", cocinar: "cocina", construir: "construccion",
  cultivar: "cultivo", curar: "medicina", vigilar: "combate", fabricar: "artesania", comerciar: "social", pelear: "combate", investigar: "saber",
};

/** Conductas especiales que la simulación implementa una por una. */
export const CONDUCTAS = [
  "piromano", "cleptomano", "gloton", "insomne", "noctambulo", "madrugador", "vegetariano", "pacifista", "sanguinario", "cobarde",
  "temerario", "ermitano", "gregario", "lider", "chismoso", "mentiroso", "cuidador", "perezoso", "rebelde", "devoto",
  "supersticioso", "romantico", "celoso", "rencoroso", "generoso", "avaro", "nomada", "sonambulo", "hipocondriaco", "cantor",
  "narrador", "bromista", "protector", "fiel", "enamoradizo", "desapegado", "coleccionista", "curandero", "belicoso", "visionario",
] as const;
export type Conducta = (typeof CONDUCTAS)[number];

/** Situaciones que se evalúan cada pocos segundos: un rasgo puede dar ánimo mientras se cumplen. */
export const CONDICIONES = [
  "lluvia", "tormenta", "nieve", "noche", "dia", "oscuridad", "solo", "acompanado", "multitud", "fuego_cerca", "en_casa", "intemperie",
  "bosque", "frio", "calor", "trabajando", "ocioso", "combate", "herido", "animales_cerca", "lobos_cerca", "lleno", "hambre", "pareja_cerca",
  "ninos_cerca", "lider_cerca", "totem_cerca", "flores_cerca", "estrellas",
] as const;
export type Condicion = (typeof CONDICIONES)[number];

/** Recuerdos que dejan los sucesos; los rasgos los amplifican, atenúan o invierten. */
export const RECUERDOS = [
  "muerte_amigo", "muerte_familiar", "muerte_vista", "mato_persona", "mato_animal", "comio_bien", "comio_crudo", "durmio_mal", "durmio_bien",
  "robado", "insultado", "charla", "regalo", "victoria", "derrota", "nacimiento", "bendicion", "maldicion", "pelea", "trabajo_hecho",
  "obra_terminada", "rechazo", "pareja", "ruptura", "incendio", "crisis_ajena", "cancion", "historia", "lluvia_divina", "intervencion",
] as const;
export type Recuerdo = (typeof RECUERDOS)[number];

export interface PensamientoRasgo {
  readonly cuando: Condicion;
  readonly valor: number;
  readonly texto: string;
}

export interface EfectosRasgo {
  /** Multiplicadores (1 = normal). */
  readonly stats?: Partial<Record<Stat, number>>;
  /** Gusto por cada trabajo (1 = normal, 0 = se niega, >1 = lo prefiere). */
  readonly trabajo?: Partial<Record<Trabajo, number>>;
  /** Suma fija al ánimo. */
  readonly animo?: number;
  /** Ánimo mientras se cumple una situación. */
  readonly pensamientos?: readonly PensamientoRasgo[];
  /** Cómo le pegan los recuerdos (multiplica el valor; negativo = al revés). */
  readonly reacciones?: Partial<Record<Recuerdo, number>>;
  /** Multiplica TODOS los recuerdos (sensible > 1, estoico < 1). */
  readonly intensidad?: number;
  /** Social: amabilidad (charlas buenas), conflicto (insultos/peleas), romance, y opinión que despierta en otros. */
  readonly social?: { readonly amabilidad?: number; readonly conflicto?: number; readonly romance?: number; readonly opinion?: number };
  /** Tolerancia térmica en °C (positivo = aguanta más el frío / el calor). */
  readonly toleraFrio?: number;
  readonly toleraCalor?: number;
  readonly conductas?: readonly Conducta[];
  /** Umbral de crisis (multiplica la probabilidad). */
  readonly crisis?: number;
}

export interface Rasgo {
  readonly id: string;
  readonly nombre: string;
  readonly categoria: string;
  readonly descripcion: string;
  /** Peso al sortear (más alto = más común). */
  readonly frecuencia: number;
  /** -1 malo, 0 neutro, 1 bueno (para equilibrar a cada colono y para el poder "inspirar"). */
  readonly valencia: -1 | 0 | 1;
  readonly efectos: EfectosRasgo;
  readonly incompatibles?: readonly string[];
}

/** Ejes de personalidad (de -1 a 1). */
export const EJES = ["sociable", "valiente", "trabajador", "empatico", "impulsivo"] as const;
export type Eje = (typeof EJES)[number];
export type Personalidad = Record<Eje, number>;
