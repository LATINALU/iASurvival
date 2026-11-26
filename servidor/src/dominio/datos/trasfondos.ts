// Trasfondos (20 de infancia + 20 de vida adulta), nombres y piezas de apariencia de los colonos y de las tribus.

import type { Habilidad, Trabajo } from "./esquema.ts";

export interface Trasfondo {
  readonly id: string;
  readonly etapa: "infancia" | "adultez";
  readonly nombre: string;
  readonly descripcion: string;
  /** Niveles extra de habilidad. */
  readonly habilidades: Partial<Record<Habilidad, number>>;
  /** Trabajos que no hará nunca por su pasado. */
  readonly niega?: readonly Trabajo[];
}

const t = (etapa: Trasfondo["etapa"], id: string, nombre: string, descripcion: string, habilidades: Trasfondo["habilidades"], niega?: Trabajo[]): Trasfondo =>
  ({ id, etapa, nombre, descripcion, habilidades, niega });

export const TRASFONDOS: readonly Trasfondo[] = [
  t("infancia", "hijo_pescador", "Hijo de pescadores", "Creció junto al agua, remendando redes.", { recoleccion: 2, artesania: 1 }),
  t("infancia", "huerfano_bosque", "Huérfano del bosque", "Sobrevivió solo entre los árboles.", { recoleccion: 3, caza: 2 }),
  t("infancia", "aprendiz_herrero", "Aprendiz de herrero", "Pasó la niñez entre martillos y brasas.", { artesania: 3, mineria: 1 }),
  t("infancia", "pastor", "Pastorcillo", "Cuidó cabras en las colinas.", { caza: 1, social: 1, cultivo: 1 }),
  t("infancia", "hijo_jefe", "Hijo del jefe", "Educado para mandar, poco para trabajar.", { social: 3, combate: 1 }, ["minar"]),
  t("infancia", "nino_salvaje", "Criado por lobos", "Dicen que los lobos lo cuidaron.", { caza: 3, combate: 2, social: -2 }, ["comerciar"]),
  t("infancia", "recolectora", "Recolector de raíces", "Conocía cada baya del valle.", { recoleccion: 3, cultivo: 1 }),
  t("infancia", "hijo_curandera", "Hijo de curanderos", "Aprendió a moler hierbas antes que a hablar.", { medicina: 3 }),
  t("infancia", "cocina_familiar", "Criado en una cocina", "Siempre olía a guiso.", { cocina: 3 }),
  t("infancia", "minero_nino", "Niño minero", "Se arrastró por túneles demasiado pronto.", { mineria: 3, construccion: 1 }),
  t("infancia", "aprendiz_carpintero", "Aprendiz de carpintero", "Las virutas fueron sus juguetes.", { construccion: 2, tala: 2 }),
  t("infancia", "nino_mimado", "Niño mimado", "Nunca le faltó nada… ni le tocó hacer nada.", { social: 2 }, ["talar", "minar"]),
  t("infancia", "ladronzuelo", "Ladronzuelo", "Robaba fruta para comer.", { social: 1, recoleccion: 1, combate: 1 }),
  t("infancia", "hijo_granjero", "Hijo de granjeros", "Sembró antes de saber leer el cielo.", { cultivo: 3, cocina: 1 }),
  t("infancia", "aprendiz_cazador", "Aprendiz de cazador", "Acompañaba a su tío en las batidas.", { caza: 3, tala: 1 }),
  t("infancia", "nino_enfermo", "Niño enfermizo", "Pasó años en cama leyendo las estrellas.", { medicina: 1, saber: 2 }),
  t("infancia", "hijo_guerrero", "Hijo de guerreros", "Jugaba a las espadas con palos.", { combate: 3 }),
  t("infancia", "nino_nomada", "Niño de caravana", "Creció de camino en camino.", { social: 2, recoleccion: 1, caza: 1 }),
  t("infancia", "aprendiz_cantero", "Aprendiz de cantero", "Partía piedras con su padre.", { mineria: 2, construccion: 2 }),
  t("infancia", "nino_templo", "Criado junto al tótem", "Los ancianos le enseñaron los ritos.", { social: 1, medicina: 1, saber: 2 }, ["pelear"]),

  t("adultez", "lenador_prof", "Leñador", "Años derribando robles.", { tala: 4, construccion: 1 }),
  t("adultez", "cazador_prof", "Cazador", "Vivía de lo que cazaba.", { caza: 4, combate: 1 }),
  t("adultez", "agricultor_prof", "Granjero", "Sus cosechas alimentaron a muchos.", { cultivo: 4, cocina: 1 }),
  t("adultez", "constructor_prof", "Constructor", "Levantó media aldea con sus manos.", { construccion: 4, tala: 1 }),
  t("adultez", "curandero_prof", "Curandero", "Remendó heridas de todo tipo.", { medicina: 4 }),
  t("adultez", "guerrero_prof", "Guerrero", "Luchó en guerras que nadie recuerda.", { combate: 4, caza: 1 }),
  t("adultez", "mercader", "Mercader", "Vendía de todo a todos.", { social: 4 }, ["minar"]),
  t("adultez", "cocinero_prof", "Cocinero de aldea", "Nadie se fue con hambre de su fogón.", { cocina: 4 }),
  t("adultez", "artesano", "Artesano", "Tallaba herramientas y adornos.", { artesania: 4 }),
  t("adultez", "minero_prof", "Minero", "Conoce la montaña por dentro.", { mineria: 4 }),
  t("adultez", "explorador", "Explorador", "Cartografió valles lejanos.", { caza: 2, recoleccion: 2, social: 1 }),
  t("adultez", "jefe_caido", "Jefe caído", "Gobernó una tribu que ya no existe.", { social: 3, combate: 2, saber: 1 }, ["recolectar"]),
  t("adultez", "ermitano_prof", "Ermitaño del monte", "Vivió años solo en una cueva.", { recoleccion: 2, medicina: 1, mineria: 1 }, ["comerciar"]),
  t("adultez", "bandido", "Bandido", "Asaltó caminos hasta que se cansó.", { combate: 3, caza: 1 }, ["curar"]),
  t("adultez", "juglar", "Juglar", "Cantaba de aldea en aldea.", { social: 4 }, ["minar", "talar"]),
  t("adultez", "esclavo_liberado", "Esclavo liberado", "Trabajó a la fuerza; ahora trabaja por elección.", { mineria: 2, construccion: 2, tala: 1 }),
  t("adultez", "chaman", "Chamán", "Habla con los espíritus del bosque.", { medicina: 2, social: 1, saber: 3 }, ["pelear"]),
  t("adultez", "pescador_prof", "Pescador", "El río le daba de comer cada día.", { recoleccion: 3, artesania: 1 }),
  t("adultez", "herrero", "Herrero", "Forjó armas para reyes sin nombre.", { artesania: 3, mineria: 2 }),
  t("adultez", "vagabundo", "Vagabundo", "Nunca se quedó mucho en ningún sitio.", { recoleccion: 1, caza: 1, social: 1, combate: 1 }),
];

export const TRASFONDO_POR_ID: ReadonlyMap<string, Trasfondo> = new Map(TRASFONDOS.map((x) => [x.id, x]));

// ------------------------------------------------------------ nombres

export const NOMBRES_F = ["Ada", "Brisa", "Dara", "Fiora", "Hela", "Jana", "Lía", "Nora", "Pía", "Runa", "Tara", "Vera", "Xena", "Yara", "Zoe", "Abril", "Cira", "Eva", "Gala", "Iris", "Kira", "Mara", "Olga", "Rita", "Sol", "Uma", "Alba", "Coral", "Duna", "Flor", "Hana", "Inés", "Lara", "Nahia", "Petra", "Selva", "Valia", "Zaida", "Ámbar", "Celia", "Enea", "Greta", "Juno", "Aine", "Brenna", "Calla", "Delia", "Elda", "Fara", "Gisela", "Hebe", "Ilse", "Jara", "Kaia", "Leire", "Maia", "Naia", "Oria", "Paz", "Quira", "Rhea", "Saba", "Tisa", "Ula", "Vesna", "Wanda", "Ximena", "Yaiza", "Zuri", "Adara", "Bruna", "Candela", "Dafne", "Elba", "Fedra", "Gaia", "Helga", "Idoia", "Jimena", "Kenia", "Lucía", "Malva", "Nerea", "Olvido", "Perla", "Quiteria", "Rocío", "Sira", "Tea", "Usue", "Violeta", "Wilma", "Ainara", "Berta", "Cloe", "Dalia", "Erika", "Fabia", "Gema", "Hilda", "Itziar", "Jade", "Kora", "Lola", "Mirra", "Nívea", "Onda", "Pilar", "Raisa", "Sabela", "Tecla", "Ursa", "Vida", "Yolanda", "Zelda", "Aurora", "Brigida", "Carmela"];
export const NOMBRES_M = ["Cael", "Eneko", "Gael", "Iker", "Kael", "Mael", "Oren", "Quim", "Saúl", "Ulises", "Wil", "Yago", "Bruno", "Dante", "Fede", "Hugo", "Joel", "Leo", "Nilo", "Pau", "Teo", "Vito", "Bael", "Elio", "Gorka", "Jaro", "Milo", "Odín", "Ramón", "Tadeo", "Urko", "Bosco", "Darío", "Fausto", "Héctor", "Ivo", "Aitor", "Basilio", "Ciro", "Duncan", "Emil", "Fabio", "Gonzalo", "Hernán", "Ismael", "Jonás", "Koldo", "Lisandro", "Marco", "Nemo", "Osric", "Pelayo", "Quirino", "Rodrigo", "Silvano", "Telmo", "Unai", "Valerio", "Wenceslao", "Xabier", "Yeray", "Zacarías", "Abel", "Benicio", "Cosme", "Damián", "Eloy", "Fermín", "Gaspar", "Horacio", "Isaac", "Julián", "Kilian", "Lázaro", "Mateo", "Néstor", "Octavio", "Pascual", "Rómulo", "Sandro", "Tristán", "Urbano", "Vasco", "Waldo", "Yuri", "Zenón", "Alonso", "Bernardo", "Cayetano", "Domingo", "Esteban", "Florián", "Gregorio", "Hilario", "Ignacio", "Joaquín", "Lucio", "Marcial", "Nicanor", "Orestes", "Plácido", "Ruperto", "Simón", "Toribio", "Ubaldo", "Venancio", "Amaru", "Bóreas", "Cronos", "Eirik", "Gunnar", "Halvar", "Ingo", "Jarl", "Knut", "Leif", "Magnus", "Njal", "Olaf", "Ragnar", "Sigurd", "Torvald", "Ulf"];
export const NOMBRES = [...NOMBRES_F, ...NOMBRES_M];
export const APODOS = ["el Tuerto", "la Roca", "Manos Rápidas", "el Sabio", "Ojo de Halcón", "la Brasa", "el Callado", "Pies Ligeros", "el Viejo", "la Risa", "Diente de Lobo", "el Terco", "Barba de Ceniza", "la Alondra", "el Manso", "Corazón de Roble", "la Sombra", "el Errante", "Voz de Trueno", "la Paciente", "el Cojo", "Puño de Hierro", "la Curandera", "el Soñador", "Ojos de Lluvia", "el Rojo", "la Silenciosa", "el Bravo", "Mano de Plata", "la Loba", "el Herrero", "Pluma Blanca", "el Último", "la Primera", "Cara de Luna", "el Zorro"];

/** Títulos de una civilización según su tamaño y su era (de clan a imperio). */
export const RANGOS: ReadonlyArray<{ readonly minPoblacion: number; readonly minEra: number; readonly titulos: readonly string[] }> = [
  { minPoblacion: 0, minEra: 1, titulos: ["Clan", "Tribu", "Hijos", "Gente", "Hermandad", "Pueblo"] },
  { minPoblacion: 14, minEra: 1, titulos: ["Aldea", "Comarca", "Villa"] },
  { minPoblacion: 24, minEra: 2, titulos: ["Señorío", "Ciudad"] },
  { minPoblacion: 34, minEra: 2, titulos: ["Reino"] },
  { minPoblacion: 45, minEra: 3, titulos: ["Imperio"] },
];
export const NUCLEOS_TRIBU = ["del Lobo Gris", "del Río Lento", "del Roble Viejo", "del Ciervo Blanco", "del Cuervo", "del Sol Naciente", "del Musgo", "del Trueno", "del Pino Alto", "del Oso Pardo", "del Fuego Azul", "del Lago Quieto", "del Viento Norte", "del Halcón", "del Helecho", "de la Luna Roja", "de la Montaña Hueca", "de la Piedra Negra", "de la Niebla", "de la Llama Eterna", "de la Aurora", "de la Garza", "de la Colina Verde", "de la Estrella Fugaz", "de la Cascada", "de la Raíz Profunda", "de la Serpiente", "de la Espiga Dorada", "de las Siete Colinas", "de las Aguas Claras", "de las Hojas Rojas", "de las Cenizas", "de los Ríos Gemelos", "de los Mil Pinos", "de los Cuernos de Ciervo", "de los Valles", "del Escudo de Hueso", "del Águila Blanca", "del Jabalí Negro", "del Bisonte", "del Martillo", "del Puño de Piedra", "del Arco Largo", "del Alba", "del Ocaso", "del Lince", "del Caracol de Bronce", "del Ámbar", "del Cobre Rojo", "del Hierro Frío", "del Desierto Rojo", "de la Selva Verde", "del Glaciar", "de la Sabana", "del Pantano Oscuro", "de la Isla", "del Faro", "del Árbol Sagrado", "del Tótem Pintado", "de la Primera Luz"];
export const SIMBOLOS = ["lobo", "rio", "arbol", "ciervo", "cuervo", "sol", "hoja", "rayo", "montana", "oso", "llama", "luna", "estrella", "serpiente", "aguila", "martillo"];

// ------------------------------------------------------------ apariencia (índices que el visor interpreta)

export const PIELES = ["#f2d3b5", "#e3b48f", "#c98e64", "#a5704a", "#7c4f32", "#5a3824"];
export const COLORES_PELO = ["#1c1512", "#3b2516", "#6b4226", "#a0612f", "#c99a5a", "#e3c98a", "#8a8a8a", "#e8e4dc", "#9c3b22"];
export const PEINADOS = ["rapado", "corto", "melena", "coleta", "trenzas", "mohicano", "mono", "rizado", "calvo"] as const;
export const BARBAS = ["ninguna", "ninguna", "ninguna", "corta", "larga", "bigote", "perilla"] as const;
export const COMPLEXIONES = ["delgado", "normal", "robusto", "ancho"] as const;
