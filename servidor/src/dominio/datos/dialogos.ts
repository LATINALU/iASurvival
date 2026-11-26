// Lo que dicen los colonos. Las charlas dependen de la situación (clima, estación, hambre, frío, guerra, lobos,
// inventos, nacimientos y muertes recientes, el trabajo que hacen, la era de su pueblo…) y del tipo de
// interacción (broma, insulto, consuelo, coqueteo, chisme, historia, canción). {x} = otro colono, {t} = su tribu,
// {o} = otra tribu, {e} = estación.

export const DIALOGOS: Readonly<Record<string, readonly string[]>> = {
  saludo: [
    "¡Buen día!", "¿Qué tal amaneciste?", "Me alegra verte.", "¿Cómo va todo?", "Ahí vamos, ¿y tú?",
    "¿Dormiste bien?", "¡Hola, {x}!", "Hoy tengo buena energía.", "Otro día más en {t}.", "¿Qué te trae por aquí?",
  ],
  lluvia: [
    "Esta lluvia no para nunca.", "Al menos los huertos estarán contentos.", "Tengo los pies empapados.", "Huele a tierra mojada.",
    "Con esta lluvia no hay quien encienda el fuego.", "Ojalá escampe antes de la noche.", "El río va a crecer.",
  ],
  tormenta: [
    "¡Qué truenos! Los dioses están enojados.", "Vi un rayo caer cerca del bosque.", "Mejor quedarse bajo techo.",
    "Mi abuela decía que las tormentas traen cambios.", "No me gusta nada este cielo.",
  ],
  nieve: [
    "Todo está blanco… qué silencio.", "Hay que cuidar la leña, el invierno es largo.", "Se me congelan las manos.",
    "Los lobos bajan más con la nieve.", "Los niños se divierten, al menos.", "Ojalá llegue pronto la primavera.",
  ],
  frio: [
    "¡Qué frío hace!", "No siento los dedos.", "Arrímate al fuego, que hay sitio.", "Necesito un abrigo de piel.",
    "Esta noche va a helar.", "El frío se mete en los huesos.",
  ],
  calor: [
    "Este calor no hay quien lo aguante.", "Voy a buscar sombra.", "El río está más bajo que nunca.", "Hasta las moscas están cansadas.",
  ],
  primavera: [
    "Ya florecen los campos.", "Es buen momento para sembrar.", "Los pájaros volvieron.", "La primavera siempre me pone de buen humor.",
  ],
  verano: [
    "Días largos, buenas cosechas.", "Deberíamos guardar comida para el invierno.", "Qué noches tan claras hace.", "El verano es para trabajar duro.",
  ],
  otoño: [
    "Las hojas empiezan a caer.", "Hay que llenar el granero antes del invierno.", "Me gusta el olor del otoño.", "Pronto hará frío de verdad.",
  ],
  invierno: [
    "Este invierno será duro.", "¿Queda suficiente leña?", "Cuento los días hasta la primavera.", "En invierno se ve quién es amigo de verdad.",
  ],
  hambre: [
    "Tengo un hambre que me comería un oso.", "Ojalá los cazadores vuelvan con algo.", "Los graneros están medio vacíos…",
    "Hoy solo comí unas bayas.", "Si no cazamos pronto, lo vamos a pasar mal.",
  ],
  sed: ["Tengo la boca seca.", "Voy al pozo, ¿vienes?", "Necesito agua fresca."],
  cansado: ["Estoy agotado.", "Necesito dormir un poco.", "Hoy trabajé de sol a sol.", "Me duelen hasta las pestañas."],
  talar: ["Este roble nos dará buena madera.", "¡Cuidado, que cae el árbol!", "Me salió una ampolla de tanto talar.", "El bosque es generoso."],
  minar: ["La roca está dura hoy.", "Encontré una veta brillante.", "Hay mineral en esa colina.", "El polvo de piedra me hace toser."],
  construir: ["Esta casa va a quedar firme.", "Pásame esa viga.", "Una pared más y está.", "Me gusta cómo crece el poblado.", "Construimos para nuestros hijos."],
  cazar: ["Vi huellas de ciervo junto al río.", "Hoy volví con las manos vacías.", "Hay que acercarse contra el viento.", "Ese jabalí casi me ensarta."],
  cocinar: ["Hoy hay guiso, ¡que nadie se lo pierda!", "Le falta sal… si tuviéramos sal.", "El pan de raíces me salió bueno.", "Huele de maravilla, ¿verdad?"],
  forja: ["El metal canta cuando lo golpeas bien.", "Este hierro será una buena espada.", "El fuego de la forja nunca duerme.", "Con estas herramientas trabajaremos el doble."],
  guerra: [
    "No confío en {o}.", "Si {o} vuelve a atacarnos, estaremos listos.", "La guerra solo trae viudas.", "Hay que reforzar la muralla.",
    "He soñado con fuego en las casas.", "Que los dioses nos protejan de {o}.", "Un día haremos la paz… o eso espero.",
  ],
  lobos: ["Se oyen aullidos… no te alejes del fuego.", "Anoche los lobos rondaban el poblado.", "Con la lanza a mano duermo mejor."],
  muerte: [
    "Todavía no me creo que se haya ido.", "Que descanse en paz.", "La muerte nos alcanza a todos, pero tan pronto…",
    "Hay que cuidarnos más entre todos.", "Lo voy a echar de menos.",
  ],
  nacimiento: ["¡Qué alegría el nuevo bebé!", "Los niños son el futuro de {t}.", "Hay que construir más casas, la familia crece."],
  invento: [
    "¿Viste lo que inventaron? ¡Increíble!", "Con esto lo cambiaremos todo.", "Los sabios no paran de sorprenderme.",
    "Mi abuelo no lo habría creído.", "El saber es la mejor arma.",
  ],
  amor: [
    "Tus ojos brillan como el fuego.", "¿Te sientas conmigo esta noche?", "Contigo el invierno se hace corto.", "Me alegra el día verte.",
    "Te traje unas flores del prado.", "¿Damos un paseo junto al río?",
  ],
  chisme: [
    "¿Sabías lo que hizo {x} anoche?", "Dicen que {x} esconde comida.", "{x} no es de fiar, te lo digo yo.", "A {x} le gusta alguien de la otra tribu…",
    "He visto a {x} hablando sola junto al tótem.", "{x} se cree el jefe, pero no lo es.",
  ],
  broma: [
    "¡Te queda bien el barro en la cara!", "Si el lobo te ve, se ríe.", "¿Eso era un hacha o una cuchara?", "Roncas más fuerte que un oso.",
    "Hasta el conejo corre mejor que tú.", "Tu guiso podría tumbar a un jabalí.",
  ],
  insulto: [
    "Eres más inútil que un hacha de musgo.", "Nadie te soporta.", "Apestas a pantano.", "Vuelve a tu cueva.", "Mientras trabajas, yo envejezco.",
    "¿Otra vez escaqueándote?", "Tienes menos luces que una noche sin luna.",
  ],
  consuelo: ["Todo va a salir bien.", "Estoy contigo.", "Mañana será otro día.", "Llora si lo necesitas, aquí estoy.", "Saldremos de esta juntos."],
  historia: [
    "…y entonces el oso se levantó sobre dos patas…", "Mi abuela contaba que en el lago vive un espíritu.",
    "Hace muchos inviernos, una tribu cruzó las montañas…", "Dicen que el primer fuego lo robó un cuervo.",
    "Cuentan que bajo la colina duerme un gigante de piedra.", "…y así fue como el río cambió de cauce.",
  ],
  cancion: [
    "♪ Bajo el roble viejo, la luna se esconde… ♪", "♪ Leña al fuego, pan en la mesa… ♪", "♪ El río canta, el lobo calla… ♪",
    "♪ Volverá la primavera, volverá… ♪", "♪ Hijos del valle, hijos del sol… ♪",
  ],
  filosofia: [
    "¿Qué habrá más allá de las montañas?", "A veces pienso que las estrellas nos miran.", "Lo único seguro es que todo cambia.",
    "¿Crees que alguien nos observa desde arriba?", "Somos tan pequeños bajo este cielo…",
  ],
  lider: ["El consejo decidió construir más casas.", "Hay que obedecer a quien nos guía.", "No estoy de acuerdo con lo que decidió el jefe."],
  rebeldia: ["Un día me iré y fundaré mi propio pueblo.", "Aquí nadie me escucha.", "Estoy harto de recibir órdenes."],
  comercio: ["Los de {o} tienen buena piedra.", "Podríamos cambiar pieles por herramientas.", "El camino a {o} está más transitado."],
};
