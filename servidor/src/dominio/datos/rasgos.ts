// Los 100 rasgos de los colonos, en 10 categorías. Todo es dato: la simulación lee `efectos` (stats, gusto por
// cada trabajo, ánimo situacional, reacción a recuerdos, social, tolerancia térmica, conductas especiales).
// Nombres y textos propios del juego. Cada colono nace con 2-4 rasgos compatibles (ver colonos.ts).

import type { EfectosRasgo, Rasgo } from "./esquema.ts";

const r = (id: string, nombre: string, categoria: string, valencia: -1 | 0 | 1, descripcion: string, efectos: EfectosRasgo, incompatibles: string[] = [], frecuencia = 5): Rasgo =>
  ({ id, nombre, categoria, valencia, descripcion, efectos, incompatibles, frecuencia });

export const RASGOS: readonly Rasgo[] = [
  // ------------------------------------------------------------ temperamento
  r("optimista", "Optimista", "temperamento", 1, "Ve el lado bueno de todo.", { animo: 8, crisis: 0.7 }, ["pesimista", "melancolico"]),
  r("pesimista", "Pesimista", "temperamento", -1, "Siempre espera lo peor.", { animo: -8, crisis: 1.3 }, ["optimista", "alegre"]),
  r("sereno", "Sereno", "temperamento", 1, "Nada lo altera demasiado.", { intensidad: 0.6, crisis: 0.6 }, ["sensible", "irascible", "ansioso"]),
  r("sensible", "Sensible", "temperamento", 0, "Lo bueno y lo malo le llegan el doble.", { intensidad: 1.6 }, ["sereno"]),
  r("irascible", "Irascible", "temperamento", -1, "Estalla por cualquier cosa.", { social: { conflicto: 2 }, reacciones: { insultado: 1.8 }, crisis: 1.2 }, ["sereno", "paciente"]),
  r("paciente", "Paciente", "temperamento", 1, "Espera su momento sin quejarse.", { social: { conflicto: 0.5 }, stats: { trabajo: 1.05 } }, ["irascible", "arrebatado"]),
  r("ansioso", "Ansioso", "temperamento", -1, "Vive con el corazón en la boca.", { animo: -4, pensamientos: [{ cuando: "oscuridad", valor: -6, texto: "La oscuridad me inquieta" }, { cuando: "combate", valor: -8, texto: "No soporto la violencia" }], crisis: 1.3 }, ["sereno", "temerario"]),
  r("alegre", "Alegre", "temperamento", 1, "Contagia buen humor.", { animo: 5, social: { amabilidad: 1.5, opinion: 5 } }, ["pesimista", "melancolico"]),
  r("melancolico", "Melancólico", "temperamento", -1, "Una tristeza suave lo acompaña siempre.", { animo: -6, pensamientos: [{ cuando: "lluvia", valor: 4, texto: "La lluvia acompaña mi pena" }] }, ["optimista", "alegre"]),
  r("arrebatado", "Arrebatado", "temperamento", -1, "Actúa antes de pensar.", { stats: { velocidad: 1.05 }, social: { conflicto: 1.5 }, crisis: 1.15 }, ["paciente"]),

  // ------------------------------------------------------------ social
  r("gregario", "Gregario", "social", 0, "Necesita gente alrededor.", { pensamientos: [{ cuando: "acompanado", valor: 5, texto: "Me gusta estar con otros" }, { cuando: "solo", valor: -6, texto: "Me siento solo" }], conductas: ["gregario"] }, ["ermitano"]),
  r("ermitano", "Ermitaño", "social", 0, "Prefiere su propia compañía.", { pensamientos: [{ cuando: "solo", valor: 6, texto: "Por fin, silencio" }, { cuando: "multitud", valor: -8, texto: "Demasiada gente" }], social: { amabilidad: 0.6 }, conductas: ["ermitano"] }, ["gregario", "carismatico"]),
  r("carismatico", "Carismático", "social", 1, "Cae bien a todo el mundo.", { stats: { carisma: 1.6 }, social: { amabilidad: 1.4, opinion: 12 }, trabajo: { comerciar: 1.6 }, conductas: ["lider"] }, ["antipatico", "ermitano"], 3),
  r("antipatico", "Antipático", "social", -1, "Tiene un don para caer mal.", { stats: { carisma: 0.6 }, social: { opinion: -12, conflicto: 1.3 }, trabajo: { comerciar: 0.5 } }, ["carismatico", "alegre"]),
  r("chismoso", "Chismoso", "social", 0, "Sabe todo de todos, y lo cuenta.", { social: { amabilidad: 1.2, conflicto: 1.2 }, conductas: ["chismoso"] }),
  r("mentiroso", "Mentiroso", "social", -1, "La verdad le parece un detalle.", { social: { opinion: -6 }, trabajo: { comerciar: 1.3 }, conductas: ["mentiroso"] }, ["honrado"]),
  r("generoso", "Generoso", "social", 1, "Comparte lo que tiene.", { reacciones: { regalo: 1.5 }, social: { opinion: 6 }, conductas: ["generoso"] }, ["avaro", "egoista"]),
  r("avaro", "Avaro", "social", -1, "Le duele soltar una sola baya.", { social: { opinion: -4 }, trabajo: { comerciar: 1.2 }, conductas: ["avaro"] }, ["generoso"]),
  r("leal", "Leal", "social", 1, "Jamás abandona a su tribu.", { reacciones: { muerte_amigo: 1.3 }, social: { opinion: 4 }, conductas: ["fiel"] }, ["rebelde"]),
  r("desconfiado", "Desconfiado", "social", 0, "Duerme con un ojo abierto.", { social: { amabilidad: 0.7 }, stats: { vision: 1.2 }, reacciones: { robado: 0.6 } }),

  // ------------------------------------------------------------ trabajo
  r("incansable", "Incansable", "trabajo", 1, "Trabaja sin parar.", { stats: { trabajo: 1.3, sueno: 1.1 }, pensamientos: [{ cuando: "trabajando", valor: 3, texto: "El trabajo me llena" }] }, ["perezoso"], 3),
  r("perezoso", "Perezoso", "trabajo", -1, "Cualquier excusa es buena para descansar.", { stats: { trabajo: 0.7 }, pensamientos: [{ cuando: "ocioso", valor: 5, texto: "Qué bien se está sin hacer nada" }], conductas: ["perezoso"] }, ["incansable", "perfeccionista"]),
  r("perfeccionista", "Perfeccionista", "trabajo", 0, "Lento, pero todo le queda impecable.", { stats: { trabajo: 0.85 }, reacciones: { obra_terminada: 2, trabajo_hecho: 1.5 }, trabajo: { construir: 1.3, fabricar: 1.3 } }, ["perezoso"]),
  r("manitas", "Manitas", "trabajo", 1, "Arregla y fabrica cualquier cosa.", { trabajo: { fabricar: 2, construir: 1.3 } }),
  r("constructor", "Constructor nato", "trabajo", 1, "Levantar paredes es lo suyo.", { trabajo: { construir: 2 }, reacciones: { obra_terminada: 1.5 } }),
  r("cazador", "Cazador nato", "trabajo", 1, "Lee las huellas como un libro.", { trabajo: { cazar: 2 }, stats: { sigilo: 1.4 }, reacciones: { mato_animal: -0.5 } }, ["amante_animales", "vegetariano"]),
  r("agricultor", "Agricultor", "trabajo", 1, "Tiene buena mano con la tierra.", { trabajo: { cultivar: 2 }, pensamientos: [{ cuando: "flores_cerca", valor: 3, texto: "Me gusta ver crecer las cosas" }] }),
  r("cocinero", "Cocinero", "trabajo", 1, "Hasta las raíces le quedan ricas.", { trabajo: { cocinar: 2 }, reacciones: { comio_bien: 1.5 } }),
  r("minero", "Minero", "trabajo", 1, "La roca no tiene secretos para él.", { trabajo: { minar: 2 }, stats: { fuerza: 1.1 } }),
  r("lenador", "Leñador", "trabajo", 1, "Derriba árboles como quien corta pan.", { trabajo: { talar: 2 }, stats: { fuerza: 1.1 } }),

  // ------------------------------------------------------------ cuerpo
  r("fuerte", "Fuerte", "cuerpo", 1, "Carga el doble y pega más duro.", { stats: { fuerza: 1.4, defensa: 1.1 } }, ["debil"]),
  r("debil", "Frágil", "cuerpo", -1, "Se cansa y se rompe con facilidad.", { stats: { fuerza: 0.7, defensa: 0.8 } }, ["fuerte", "robusto"]),
  r("veloz", "Veloz", "cuerpo", 1, "Corre como el viento.", { stats: { velocidad: 1.3 } }, ["lento"]),
  r("lento", "Lento", "cuerpo", -1, "Va a su ritmo, que es despacio.", { stats: { velocidad: 0.75 } }, ["veloz"]),
  r("piel_dura", "Piel dura", "cuerpo", 1, "El frío apenas le hace cosquillas.", { toleraFrio: 8 }, ["friolero"]),
  r("friolero", "Friolero", "cuerpo", -1, "Tirita con cualquier brisa.", { toleraFrio: -6, pensamientos: [{ cuando: "frio", valor: -6, texto: "¡Qué frío hace!" }] }, ["piel_dura"]),
  r("robusto", "Robusto", "cuerpo", 1, "Aguanta el dolor sin pestañear.", { stats: { dolor: 1.5, defensa: 1.2 } }, ["debil", "hipocondriaco"]),
  r("enfermizo", "Enfermizo", "cuerpo", -1, "Pilla todas las enfermedades.", { stats: { curacion: 0.6, defensa: 0.9 } }, ["robusto"]),
  r("gloton", "Glotón", "cuerpo", -1, "Siempre tiene hambre.", { stats: { apetito: 1.5 }, reacciones: { comio_bien: 1.5 }, conductas: ["gloton"] }, ["frugal"]),
  r("frugal", "Frugal", "cuerpo", 1, "Vive con un puñado de bayas.", { stats: { apetito: 0.65 } }, ["gloton"]),

  // ------------------------------------------------------------ mente
  r("brillante", "Brillante", "mente", 1, "Aprende todo a la primera.", { stats: { aprendizaje: 1.7 }, trabajo: { investigar: 2 } }, ["torpe"], 3),
  r("torpe", "Torpe", "mente", -1, "Le cuesta pillar las cosas.", { stats: { aprendizaje: 0.6, trabajo: 0.9 } }, ["brillante"]),
  r("curioso", "Curioso", "mente", 0, "Quiere ver qué hay detrás de cada colina.", { conductas: ["nomada"], pensamientos: [{ cuando: "bosque", valor: 2, texto: "¡Cuánto por descubrir!" }] }, ["hogareno"]),
  r("despistado", "Despistado", "mente", -1, "Olvida a qué iba.", { stats: { trabajo: 0.9 }, intensidad: 0.8 }),
  r("sonador", "Soñador", "mente", 0, "Vive con la cabeza en las nubes.", { pensamientos: [{ cuando: "estrellas", valor: 5, texto: "Las estrellas me hablan" }], stats: { trabajo: 0.95 } }),
  r("insomne", "Insomne", "mente", -1, "Duerme poco y mal.", { stats: { sueno: 1.3 }, reacciones: { durmio_bien: 0.5 }, conductas: ["insomne"] }, ["dormilon"]),
  r("dormilon", "Dormilón", "mente", 0, "Si lo dejan, duerme medio día.", { stats: { sueno: 0.8 }, reacciones: { durmio_bien: 1.5 } }, ["insomne", "madrugador"]),
  r("noctambulo", "Noctámbulo", "mente", 0, "Vive de noche.", { pensamientos: [{ cuando: "noche", valor: 5, texto: "La noche es mía" }, { cuando: "dia", valor: -2, texto: "Demasiado sol" }], stats: { vision: 1.3 }, conductas: ["noctambulo"] }, ["madrugador", "nictofobo"]),
  r("madrugador", "Madrugador", "mente", 1, "Ama el amanecer.", { pensamientos: [{ cuando: "dia", valor: 3, texto: "Un día nuevo" }], conductas: ["madrugador"] }, ["noctambulo", "dormilon"]),
  r("sabio_hierbas", "Sabio de hierbas", "mente", 1, "Conoce cada planta que cura.", { trabajo: { curar: 2, recolectar: 1.3 }, stats: { curacion: 1.3 }, conductas: ["curandero"] }),

  // ------------------------------------------------------------ moral
  r("pacifista", "Pacifista", "moral", 0, "Jamás levantará la mano contra nadie.", { trabajo: { pelear: 0, cazar: 0.5 }, reacciones: { mato_persona: 3, muerte_vista: 1.5 }, conductas: ["pacifista"] }, ["sanguinario", "senor_guerra", "cruel"]),
  r("sanguinario", "Sanguinario", "moral", -1, "La violencia le da vida.", { trabajo: { pelear: 2, cazar: 1.5 }, reacciones: { mato_persona: -1, muerte_vista: -0.5, pelea: -1 }, pensamientos: [{ cuando: "combate", valor: 8, texto: "¡Por fin acción!" }], conductas: ["sanguinario"] }, ["pacifista", "compasivo"], 2),
  r("compasivo", "Compasivo", "moral", 1, "Sufre con el sufrimiento ajeno.", { reacciones: { muerte_vista: 1.5, crisis_ajena: 1.5 }, trabajo: { curar: 1.5 }, social: { amabilidad: 1.4 }, conductas: ["cuidador"] }, ["sanguinario", "cruel"]),
  r("cruel", "Cruel", "moral", -1, "Disfruta haciendo daño con palabras.", { social: { conflicto: 2, opinion: -10 }, reacciones: { insultado: 0.5 } }, ["compasivo", "pacifista"]),
  r("honrado", "Honrado", "moral", 1, "Su palabra vale oro.", { social: { opinion: 6 }, reacciones: { robado: 1.5 } }, ["mentiroso", "cleptomano"]),
  r("cleptomano", "Cleptómano", "moral", -1, "Las cosas ajenas se le pegan a las manos.", { conductas: ["cleptomano"], social: { opinion: -4 } }, ["honrado"], 3),
  r("justiciero", "Justiciero", "moral", 0, "No perdona una injusticia.", { reacciones: { robado: 1.5, insultado: 1.3 }, conductas: ["rencoroso"], trabajo: { vigilar: 1.5 } }),
  r("devoto", "Devoto", "moral", 1, "Encuentra paz ante el tótem de su tribu.", { pensamientos: [{ cuando: "totem_cerca", valor: 6, texto: "Los espíritus me protegen" }], reacciones: { bendicion: 1.8, maldicion: 1.5, intervencion: 1.5 }, conductas: ["devoto"] }),
  r("rebelde", "Rebelde", "moral", -1, "Nadie le dice qué hacer.", { conductas: ["rebelde"], reacciones: { intervencion: -0.5 } }, ["leal"]),
  r("egoista", "Egoísta", "moral", -1, "Primero él, luego él, y después él.", { social: { opinion: -6 }, reacciones: { muerte_amigo: 0.5, regalo: 1.2 }, conductas: ["avaro"] }, ["generoso"]),

  // ------------------------------------------------------------ miedo y valor
  r("valiente", "Valiente", "miedo", 1, "No retrocede ante nada.", { trabajo: { pelear: 1.5, vigilar: 1.3 }, crisis: 0.85 }, ["cobarde"]),
  r("cobarde", "Cobarde", "miedo", -1, "Corre a la primera señal de peligro.", { trabajo: { pelear: 0.3 }, pensamientos: [{ cuando: "combate", valor: -10, texto: "¡Quiero huir!" }], conductas: ["cobarde"] }, ["valiente", "temerario"]),
  r("temerario", "Temerario", "miedo", 0, "El peligro le parece divertido.", { trabajo: { pelear: 1.8, cazar: 1.3 }, pensamientos: [{ cuando: "lobos_cerca", valor: 3, texto: "Que vengan" }], conductas: ["temerario"] }, ["cobarde", "ansioso"]),
  r("nictofobo", "Miedo a la oscuridad", "miedo", -1, "La noche lo paraliza.", { pensamientos: [{ cuando: "oscuridad", valor: -10, texto: "¡No veo nada!" }, { cuando: "fuego_cerca", valor: 3, texto: "La luz me calma" }] }, ["noctambulo"]),
  r("pirofobo", "Miedo al fuego", "miedo", -1, "Las llamas le aterran.", { pensamientos: [{ cuando: "fuego_cerca", valor: -6, texto: "Ese fuego me asusta" }], reacciones: { incendio: 2 }, trabajo: { cocinar: 0.4 } }, ["amante_fuego", "piromano"]),
  r("lupofobo", "Miedo a los lobos", "miedo", -1, "Un aullido y ya tiembla.", { pensamientos: [{ cuando: "lobos_cerca", valor: -12, texto: "¡Lobos!" }] }, ["temerario"]),
  r("claustrofobo", "Claustrofóbico", "miedo", -1, "Las paredes se le caen encima.", { pensamientos: [{ cuando: "en_casa", valor: -6, texto: "Necesito aire" }, { cuando: "intemperie", valor: 2, texto: "Aire libre" }] }, ["hogareno"]),
  r("agorafobo", "Agorafóbico", "miedo", -1, "Los espacios abiertos le dan vértigo.", { pensamientos: [{ cuando: "intemperie", valor: -4, texto: "Tanto cielo me marea" }, { cuando: "en_casa", valor: 4, texto: "A salvo entre paredes" }] }, ["claustrofobo", "nomada_rasgo"]),
  r("hipocondriaco", "Hipocondríaco", "miedo", -1, "Cada estornudo es el fin.", { pensamientos: [{ cuando: "herido", valor: -8, texto: "Me voy a morir" }], conductas: ["hipocondriaco"] }, ["robusto"]),
  r("supersticioso", "Supersticioso", "miedo", 0, "Ve señales en todo.", { reacciones: { intervencion: 2, bendicion: 1.5, maldicion: 2, lluvia_divina: 1.5 }, pensamientos: [{ cuando: "tormenta", valor: -6, texto: "Los cielos están enojados" }], conductas: ["supersticioso"] }),

  // ------------------------------------------------------------ naturaleza
  r("amante_bosque", "Hijo del bosque", "naturaleza", 1, "Entre árboles se siente en casa.", { pensamientos: [{ cuando: "bosque", valor: 5, texto: "El bosque me abraza" }], trabajo: { recolectar: 1.3 } }),
  r("ama_lluvia", "Ama la lluvia", "naturaleza", 0, "Baila cuando llueve.", { pensamientos: [{ cuando: "lluvia", valor: 6, texto: "¡Lluvia!" }] }, ["odia_lluvia"]),
  r("odia_lluvia", "Odia la lluvia", "naturaleza", -1, "Un día gris le arruina todo.", { pensamientos: [{ cuando: "lluvia", valor: -6, texto: "Otra vez mojado" }] }, ["ama_lluvia"]),
  r("vegetariano", "Vegetariano", "naturaleza", 0, "No come carne ni caza.", { trabajo: { cazar: 0 }, reacciones: { mato_animal: 3 }, conductas: ["vegetariano"] }, ["cazador", "sanguinario"]),
  r("amante_animales", "Amigo de los animales", "naturaleza", 1, "Los animales no huyen de él.", { pensamientos: [{ cuando: "animales_cerca", valor: 4, texto: "Qué criaturas tan bonitas" }], trabajo: { cazar: 0.4 }, reacciones: { mato_animal: 2 } }, ["cazador"]),
  r("nomada_rasgo", "Nómada", "naturaleza", 0, "No puede quedarse quieto en un sitio.", { conductas: ["nomada"], pensamientos: [{ cuando: "intemperie", valor: 3, texto: "El camino es mi casa" }], trabajo: { comerciar: 1.4 } }, ["hogareno", "agorafobo"]),
  r("hogareno", "Hogareño", "naturaleza", 1, "Nada como su cama y su fuego.", { pensamientos: [{ cuando: "en_casa", valor: 5, texto: "Hogar, dulce hogar" }], reacciones: { durmio_bien: 1.5 } }, ["nomada_rasgo", "curioso", "claustrofobo"]),
  r("amante_fuego", "Amante del fuego", "naturaleza", 0, "Podría mirar las llamas durante horas.", { pensamientos: [{ cuando: "fuego_cerca", valor: 5, texto: "El fuego me hipnotiza" }], trabajo: { cocinar: 1.3 } }, ["pirofobo"]),
  r("piromano", "Pirómano", "naturaleza", -1, "A veces, simplemente, quema cosas.", { pensamientos: [{ cuando: "fuego_cerca", valor: 8, texto: "Hermoso fuego" }], reacciones: { incendio: -1 }, conductas: ["piromano"] }, ["pirofobo"], 2),
  r("ama_flores", "Ama las flores", "naturaleza", 1, "Se para a oler cada flor.", { pensamientos: [{ cuando: "flores_cerca", valor: 4, texto: "Qué flores tan bonitas" }], trabajo: { cultivar: 1.4 } }),

  // ------------------------------------------------------------ amor y familia
  r("romantico", "Romántico", "familia", 1, "Cree en el amor eterno.", { social: { romance: 2 }, reacciones: { pareja: 1.5, ruptura: 1.8 }, pensamientos: [{ cuando: "pareja_cerca", valor: 6, texto: "Estar contigo es todo" }], conductas: ["romantico"] }, ["desapegado"]),
  r("celoso", "Celoso", "familia", -1, "No soporta que miren a su pareja.", { conductas: ["celoso"], social: { conflicto: 1.3 } }, ["desapegado"]),
  r("fiel", "Fiel", "familia", 1, "Un solo amor para toda la vida.", { conductas: ["fiel"], reacciones: { ruptura: 1.5 } }, ["enamoradizo"]),
  r("enamoradizo", "Enamoradizo", "familia", 0, "Se enamora cada semana.", { social: { romance: 2.5 }, conductas: ["enamoradizo"] }, ["fiel", "desapegado"]),
  r("desapegado", "Desapegado", "familia", 0, "El amor no va con él.", { social: { romance: 0.1 }, reacciones: { ruptura: 0.3, pareja: 0.3 }, conductas: ["desapegado"] }, ["romantico", "enamoradizo", "celoso"]),
  r("protector", "Protector", "familia", 1, "Defiende a los suyos con uñas y dientes.", { trabajo: { pelear: 1.4, vigilar: 1.5 }, conductas: ["protector"] }),
  r("ama_ninos", "Le encantan los niños", "familia", 1, "Se le ilumina la cara con un bebé.", { pensamientos: [{ cuando: "ninos_cerca", valor: 5, texto: "Los pequeños me alegran" }], reacciones: { nacimiento: 2 } }),
  r("independiente", "Independiente", "familia", 0, "No necesita a nadie.", { reacciones: { muerte_familiar: 0.6, muerte_amigo: 0.6 }, pensamientos: [{ cuando: "solo", valor: 2, texto: "Me basto solo" }] }, ["gregario"]),
  r("familiar", "Familiar", "familia", 1, "La familia lo es todo.", { reacciones: { muerte_familiar: 1.6, nacimiento: 1.5 }, pensamientos: [{ cuando: "acompanado", valor: 2, texto: "Rodeado de los míos" }] }),
  r("rencoroso", "Rencoroso", "familia", -1, "Nunca olvida una ofensa.", { reacciones: { insultado: 1.6, robado: 1.6, pelea: 1.4 }, conductas: ["rencoroso"] }),

  // ------------------------------------------------------------ rarezas
  r("sonambulo", "Sonámbulo", "rarezas", -1, "Pasea dormido por las noches.", { conductas: ["sonambulo"] }, [], 3),
  r("coleccionista", "Coleccionista", "rarezas", 0, "Guarda piedras bonitas y plumas.", { conductas: ["coleccionista"], trabajo: { recolectar: 1.3, minar: 1.2 } }),
  r("cantor", "Cantor", "rarezas", 1, "Canta al trabajar y alegra a todos.", { conductas: ["cantor"], social: { opinion: 6 } }, [], 3),
  r("cuentacuentos", "Cuentacuentos", "rarezas", 1, "Junto al fuego, sus historias encantan.", { conductas: ["narrador"], social: { amabilidad: 1.3, opinion: 5 } }, [], 3),
  r("bromista", "Bromista", "rarezas", 0, "Hace reír… o enojar.", { conductas: ["bromista"], social: { amabilidad: 1.2, conflicto: 1.2 } }),
  r("filosofo", "Filósofo", "rarezas", 0, "Medita sobre el sentido de todo.", { pensamientos: [{ cuando: "solo", valor: 3, texto: "Pensar en calma" }, { cuando: "estrellas", valor: 3, texto: "¿Qué hay más allá?" }], stats: { aprendizaje: 1.2 }, trabajo: { investigar: 1.8 } }),
  r("observador_cielo", "Lee el cielo", "rarezas", 0, "Predice el tiempo mirando las nubes.", { pensamientos: [{ cuando: "estrellas", valor: 4, texto: "Qué noche tan clara" }], reacciones: { lluvia_divina: 0.5 } }),
  r("senor_guerra", "Señor de la guerra", "rarezas", -1, "Nació para conquistar.", { conductas: ["belicoso", "lider"], trabajo: { pelear: 2 }, reacciones: { victoria: 2, derrota: 1.5 } }, ["pacifista", "cobarde"], 2),
  r("visionario", "Visionario", "rarezas", 1, "Imagina la tribu del mañana.", { conductas: ["visionario", "lider"], trabajo: { construir: 1.4 }, reacciones: { obra_terminada: 1.8 } }, [], 2),
  r("trotamundos", "Trotamundos", "rarezas", 0, "Lleva mil historias de otras tierras.", { conductas: ["nomada", "narrador"], trabajo: { comerciar: 1.5 }, social: { amabilidad: 1.2 } }, ["hogareno"]),
];

export const RASGO_POR_ID: ReadonlyMap<string, Rasgo> = new Map(RASGOS.map((x) => [x.id, x]));
export const CATEGORIAS_RASGO = [...new Set(RASGOS.map((x) => x.categoria))];
