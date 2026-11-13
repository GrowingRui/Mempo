// Español. Same keys as en.tsx (TypeScript checks it).
import type { ReactNode } from "react";
import { site } from "../config/site";
import type { InstallIcons, Messages } from "./en";
import { joinList, longDate, numberIn, addDays, shortDate } from "./format";

const locale = "es-ES";
const N = numberIn(locale);
const plural = (n: number, one: string, many: string) => `${N(n)} ${n === 1 ? one : many}`;
const words = (n: number) => plural(n, "palabra", "palabras");
/** Keeps "No lo sé" on one line. */
const nb = (s: string) => s.replace(/ /g, " ");
const b = (x: ReactNode) => <b className="text-ink">{x}</b>;

const es: Messages = {
  locale,
  num: N,

  common: {
    words,
    days: (n: number) => plural(n, "día", "días"),
    loadingWords: "Cargando palabras…",
    loadFailed: (level: string) => `No se pudieron cargar las palabras de ${level}. Revisa tu conexión e inténtalo de nuevo.`,
    backToHome: "Volver al inicio",
    back: "Volver",
    cancel: "Cancelar",
    close: "Cerrar",
    done: "Listo",
    next: "Siguiente",
    save: "Guardar",
    install: "Instalar",
    iDontKnow: "No lo sé",
    somethingWrong: "Algo salió mal. Inténtalo de nuevo.",
  },

  when: (day: string, today: string) => (day <= today ? "hoy" : day === addDays(today, 1) ? "mañana" : `el ${shortDate(day, locale)}`),
  pastDay: (day: string, today: string) => (day === today ? "Hoy" : day === addDays(today, -1) ? "Ayer" : shortDate(day, locale)),

  answer: { know: "Lo sé", unsure: "Dudo", dontknow: "No lo sé" },
  status: { new: "Nueva", learning: "Aprendiendo", review: "Repasando", mastered: "Dominada", dontknow: "No lo sé" },
  levelName: { B2: "Intermedio alto", C1: "Avanzado", C2: "Dominio" },
  pos: {
    n: "sustantivo", v: "verbo", adj: "adjetivo", adv: "adverbio", prep: "preposición", conj: "conjunción", pron: "pronombre",
    interj: "interjección", num: "número", det: "determinante", phr: "expresión", abbr: "abreviatura",
  },

  home: {
    tagline: "¡Que se te queden!",
    statsAria: (streak: number) => `Estadísticas. Racha: ${plural(streak, "día", "días")}`,
    todayAria: "Hoy",
    ofNewToday: (goal: number) => `de ${goal} palabras nuevas hoy`,
    seenIn: (level: string, seen: ReactNode, total: number) => (
      <>
        Vistas en {level}: {seen} de {N(total)} palabras
      </>
    ),
    practiceAria: "Práctica",
    reviewsDue: "Repasos",
    allWords: "Palabras",
    recall: "Recordar",
    recallSub: "Ponte a prueba con las palabras que has estudiado",
    exam: "Práctica de examen",
    examSub: "Tareas del examen de Cambridge, como formación de palabras",
    yourLevel: "Tu nivel",
    takeTest: "¿No lo sabes? Haz una prueba",
    levelAria: "Nivel",
    goalTitle: "Palabras nuevas al día",
    custom: "Otra",
    goalInputAria: "Tu propio número de palabras nuevas al día",
    wordsADay: "palabras al día",
    goalRange: (min: number, max: number) => `Elige un número del ${min} al ${max}.`,
    start: "Empezar",
    keepGoing: "Seguir",
    breakdown: (reviews: number, dontKnow: number, fresh: number) =>
      joinList(
        [reviews ? plural(reviews, "repaso", "repasos") : "", dontKnow ? `${N(dontKnow)} no lo sé` : "", fresh ? plural(fresh, "nueva", "nuevas") : ""].filter(Boolean),
        " y ",
      ),
    allSeen: (level: string) => `Ya has visto todas las palabras de ${level}. ¡Prueba otro nivel!`,
    allDone: "Todo listo por hoy. ¡Hasta mañana!",
    heldBack: (n: number, limit: number) =>
      `${n === 1 ? "Queda 1 repaso" : `Quedan ${N(n)} repasos`} para los próximos días (límite: ${limit} al día).`,
    savedHere: "Tu progreso se guarda en este navegador.",
  },

  study: {
    empty: {
      today: "No queda nada por estudiar hoy.",
      review: "No hay repasos pendientes ahora.",
      dontknow: "Tu lista “No lo sé” está vacía. ¡Bien hecho!",
    },
    niceWork: "¡Buen trabajo!",
    wentThrough: (n: number) => `Has repasado ${words(n)}.`,
    knew: "lo sabías",
    notSure: "dudaste",
    didntKnow: "no lo sabías",
    cameBack: "Cada palabra volvió hasta que te la supiste.",
    nextReview: (when: string, count: ReactNode) => (
      <>
        Próximo repaso {when}: {count}
      </>
    ),
    left: (n: number) => `faltan ${n}`,
    newWord: "Palabra nueva",
    review: "Repaso",
    onceMore: ", otra vez",
    swipeHint: (left: string, right: string) => `Desliza o usa las flechas: ← ${nb(left)}, ↑ Dudo, → ${nb(right)}`,
  },

  card: {
    offensive: "Ofensiva",
    offensiveWord: "Palabra ofensiva",
    useWithCare: "Úsala con cuidado",
    alsoSpelled: (v: string) => `También se escribe ${v}.`,
    forms: (f: string) => `Formas: ${f}`,
    showWord: "Mostrar la palabra",
    showMeaning: "Mostrar el significado",
    tapToFlip: "Toca la tarjeta para ver el significado",
    reportLink: "¿Traducción incorrecta? Avísanos",
    hear: (w: string) => `Escuchar “${w}”`,
    nextReviewStep: (when: string, box: number, max: number) => `Próximo repaso ${when}, nivel ${box} de ${max}`,
  },

  recall: {
    title: "Recordar",
    intro: (round: number) =>
      `Ponte a prueba con las palabras que ya has estudiado, empezando por las más difíciles. ${round} palabras por ronda. Tu calendario de repasos no cambia.`,
    studyFirst: "Primero estudia unas palabras",
    studyFirstSub: "Recordar pregunta palabras que ya has visto. Haz la sesión de hoy y vuelve.",
    startStudying: "Empezar a estudiar",
    kinds: {
      meaning: { title: "Significado → palabra", sub: "Lee la traducción y elige la palabra en inglés." },
      listen: { title: "Escucha → palabra", sub: "Escucha la palabra y elige cómo se escribe." },
      spell: { title: "Escríbela", sub: "Lee la traducción y escribe la palabra. ¡La más difícil!" },
      form: { title: "Formación de palabras", sub: "Cambia la palabra en mayúsculas para que encaje en la frase." },
    },
    toPractise: (n: number) => `${plural(n, "palabra estudiada", "palabras estudiadas")} para practicar.`,
    roundDone: "Ronda terminada",
    perfect: "¡Ronda perfecta!",
    rightAnswers: "respuestas correctas",
    missed: "Falladas",
    alreadyListed: (n: number) => `${n === 1 ? "Ya está" : "Ya están"} en tu lista “No lo sé”.`,
    added: "Añadidas a tu lista “No lo sé”.",
    addThese: (n: number) => (n === 1 ? "Añadirla a “No lo sé”" : `Añadir estas ${n} a “No lo sé”`),
    anotherRound: "Otra ronda",
    otherExercise: "Otro ejercicio",
    stopRound: "Terminar esta ronda",
    playAgain: "Volver a escuchar la palabra",
    tapToHear: "Toca para volver a escucharla",
    startsWith: (letter: string, len: number) => `Empieza por ${letter}, ${len} letras`,
    typeAria: "Escribe la palabra en inglés",
    typePlaceholder: "Escribe la palabra…",
    showAnswer: "Ver respuesta",
    check: "Comprobar",
    almost: "¡Casi! Revisa la ortografía:",
    theAnswer: "La respuesta:",
    whichHeard: "¿Qué palabra has oído?",
    whichIs: "¿Qué palabra es?",
    formPrompt: "Usa la palabra en mayúsculas para formar la que encaja en el hueco.",
    formAria: "Escribe la palabra que encaja en el hueco",
    wrongForm: "Palabra correcta, forma incorrecta. El hueco necesita:",
  },

  exam: {
    title: "Práctica de examen",
    intro: (round: number) =>
      `Tareas del examen Reading and Use of English de Cambridge (B2 First, C1 Advanced, C2 Proficiency). ${round} preguntas por ronda, que pueden incluir palabras que aún no has estudiado. Tu plan de repaso no cambia.`,
    part: (n: number) => `Parte ${n}`,
  },

  test: {
    title: "Prueba de nivel",
    question: "¿Cuál es tu nivel?",
    intro: (n: number) => `${n} palabras al azar de B2, C1 y C2. Elige el significado correcto o toca “No lo sé”. Sin adivinar, ¡así el resultado es fiable!`,
    answerIn: "Responder en",
    answerLangAria: "Idioma de las respuestas",
    start: "Empezar la prueba",
    about: "Unos 3 minutos. Tu progreso no cambia.",
    resultTitle: "Tu resultado",
    weSuggest: "Te sugerimos estudiar",
    rightOf: (right: number, total: number) => `${right} de ${total} correctas`,
    probablyKnow: (known: ReactNode, total: number) => (
      <>
        probablemente conoces unas {known} de {N(total)} palabras
      </>
    ),
    passNote: (pct: number) => `“Dominas” un nivel con un ${pct} % o más. Te sugerimos el primer nivel por debajo de eso.`,
    already: (level: string) => `${level} ya es tu nivel. ¡Bien!`,
    switchTo: (level: string) => `Cambiar mi nivel a ${level}`,
    again: "Repetir la prueba",
    backHome: "Volver al inicio",
    keep: (level: string) => `Seguir con ${level}`,
    stop: "Terminar la prueba",
    whatMeans: "¿Qué significa?",
  },

  stats: {
    title: "Estadísticas",
    streakAria: "Racha",
    dayStreak: (n: number) => (n === 1 ? "día seguido" : "días seguidos"),
    studiedToday: "Hoy ya has estudiado. ¡Hasta mañana!",
    keepItGoing: "Estudia hoy para mantenerla.",
    startStreak: "Estudia hoy para empezar una racha.",
    longest: (days: ReactNode) => <>Racha más larga: {days}</>,
    wordsSeen: "Palabras vistas",
    mastered: "Dominadas",
    daysStudied: "Días de estudio",
    lastDays: (n: number) => `Últimos ${n} días`,
    new: "Nuevas",
    reviewed: "Repasadas",
    dayLine: (fresh: number, reviewed: number) => `${fresh} nuevas, ${reviewed} repasadas`,
    tapDay: "Toca un día para ver sus números.",
    nothingYet: "Aún no hay nada. Tus días aparecerán aquí.",
    tableCaption: (n: number) => `Palabras por día, últimos ${n} días`,
    day: "Día",
    byLevel: "Por nivel",
    notSeen: "Sin ver",
    seenOf: (seen: ReactNode, total: number) => (
      <>
        {seen} de {N(total)} vistas
      </>
    ),
    // "1 dominada", "10 dominadas"; "aprendiendo", "repasando" and "no lo sé" don't change.
    segment: (n: number, label: string) => `${N(n)} ${(n !== 1 && label.endsWith("a") ? `${label}s` : label).toLocaleLowerCase(locale)}`,
    reviewsTotal: (n: number) => `${plural(n, "repaso", "repasos")} en total.`,
  },

  dontKnow: {
    intro: (days: number) => `Palabras que marcaste como “No lo sé”. Una palabra sale de esta lista cuando la sabes ${days} días seguidos.`,
    allClear: "¡Todo limpio!",
    empty: "No hay palabras en tu lista “No lo sé”.",
    practise: (n: number) => (n === 1 ? "Practicar esta palabra" : `Practicar estas ${n} palabras`),
  },

  wordList: {
    title: "Lista de palabras",
    search: "Busca en inglés, 中文 o español",
    searchAria: "Buscar palabras",
    allLevels: "Todos los niveles",
    anyStatus: "Cualquier estado",
    levelAria: "Nivel",
    statusAria: "Estado",
    noMatch: "Ninguna palabra coincide. Prueba con menos letras u otro filtro.",
    showMore: (n: number) => `Mostrar más (quedan ${N(n)})`,
  },

  settings: {
    title: "Ajustes",
    language: "Idioma",
    languageHint: "Para botones y mensajes. Los significados de las tarjetas se eligen en “Significados”.",
    theme: "Tema",
    themeHint: "Auto sigue la configuración de tu móvil u ordenador.",
    themes: { light: "Claro", dark: "Oscuro", system: "Auto" },
    meanings: "Significados",
    meaningsHint: "Aparecen en el reverso de la tarjeta y en las listas de palabras.",
    zhSub: "Chino",
    esSub: "Español",
    oneStaysOn: "Chino o español: al menos uno queda activado.",
    enSub: "Definiciones en inglés",
    swiping: "Deslizar",
    swipingHint: "Deslizar hacia arriba siempre es “Dudo”. Los botones siguen el mismo orden.",
    swipeAria: "Dirección de deslizamiento",
    knowOnLeft: "A la izquierda",
    knowOnRight: "A la derecha",
    reviewsPerDay: "Repasos al día",
    reviewsHint:
      "Después de una pausa, los repasos más antiguos van primero y el resto espera a los próximos días. “Repasos” en el inicio sigue permitiendo hacerlos todos.",
    noLimit: "Todos",
    reminder: "Recordatorio diario",
    offline: "Sin conexión",
    offlineHint: `Una vez cargado, ${site.name} funciona sin internet.`,
    move: "Pasar a otro dispositivo",
    moveHint: "Copia tu progreso a otro móvil, tableta o navegador con un código QR.",
    progress: "Tu progreso",
    progressHint: "Solo se guarda en este navegador. Descarga una copia de seguridad para no perderlo.",
    download: "Descargar copia",
    downloaded: "Copia descargada.",
    restore: "Restaurar copia",
    readFailed: "No se pudo leer este archivo.",
    startOver: "Empezar de cero",
    nothingToDelete: "Aún no hay nada que borrar.",
    startOverNote: "Borra todas tus palabras y el historial diario. Tus ajustes se mantienen.",
    feedback: "Comentarios",
    feedbackHint: "¿Has encontrado un problema o tienes una idea? Cuéntanoslo. Le llega directamente al desarrollador.",
    sendFeedback: "Enviar comentarios",
    privacy: "Privacidad",
    usage: "Recuento de uso anónimo",
    usageSub: `Una vez al día, avisa al desarrollador de que este dispositivo abrió ${site.name} o estudió. Un número al azar, nada sobre ti ni sobre tus palabras.`,
    restoreTitle: "¿Restaurar esta copia?",
    moveTitle: "¿Traer este progreso?",
    replace: "Reemplazar mi progreso",
    moved: (n: number) => `Progreso traído: ${words(n)}.`,
    restored: (n: number) => `Copia restaurada: ${words(n)}.`,
    madeOn: (d: Date) => `Hecha el ${longDate(d, locale)}. `,
    backupHas: (n: number, days: number) => (
      <>
        Tiene {b(words(n))} y {plural(days, "día", "días")} de historial, además de sus ajustes.
      </>
    ),
    replaces: (n: number) => `Reemplaza lo que hay ahora en este navegador (${words(n)}).`,
    noProgressHere: "Este navegador aún no tiene progreso.",
    broken: (n: number) => `Se omitirán ${N(n)} ${n === 1 ? "entrada dañada" : "entradas dañadas"} del archivo.`,
  },

  reset: {
    title: "¿Empezar de cero?",
    keep: "Mantener mi progreso",
    delete: "Borrarlo todo",
    body: (n: number) =>
      `Esto borra tu progreso con ${words(n)} en este navegador: repasos, tu lista “No lo sé” y el historial diario. Tus ajustes se mantienen. No se puede deshacer.`,
  },

  feedback: {
    legend: "¿Sobre qué es?",
    kinds: { bug: "Error", idea: "Sugerencia", word: "Palabra incorrecta", other: "Otro" },
    bugLabel: "¿Qué pasó? ¿Qué esperabas?",
    wordLabel: "¿Qué palabra y qué está mal?",
    messageLabel: "Tu mensaje",
    thanks: "¡Gracias! Enviado",
    replyByEmail: "Recibirás una respuesta por correo.",
    everyRead: "Se leen todos los mensajes.",
    email: "Tu correo",
    optional: "(opcional)",
    emailPlaceholder: "Solo si quieres una respuesta",
    byEmail: "Enviar por correo",
    detailsNote: "Se añaden la versión de la app y el tipo de dispositivo, para ayudar a resolver problemas.",
    sending: "Enviando…",
    tryAgain: "Reintentar",
    send: "Enviar",
    offline: "No tienes conexión.",
    noServer: `No se pudo conectar con el servidor de ${site.name}.`,
    cantSend: "No se pudo enviar ahora mismo.",
    tooLong: "Este mensaje es demasiado largo.",
    checkForm: "Revisa el formulario e inténtalo de nuevo.",
    notSetUp: "Los comentarios aún no están configurados en el servidor.",
    tooMany: "¡Son muchos mensajes! Espera un poco, por favor.",
  },

  report: {
    title: "Informar de un problema",
    with: (word: ReactNode) => <>con {word}</>,
    legend: "¿Qué está mal?",
    topics: { zh: "Chino", es: "Español", example: "Frase de ejemplo", other: "Otra cosa" },
    betterTranslation: "Mejor traducción (opcional)",
    whatShouldSay: "¿Qué debería decir? (opcional)",
    public: "¿Prefieres que sea público?",
    issue: "Abrir un issue en GitHub",
  },

  update: {
    ready: `Hay una nueva versión de ${site.name}.`,
    offline: `${site.name} ya funciona sin conexión.`,
    later: "Luego",
    update: "Actualizar",
  },

  install: {
    share: "Compartir",
    menu: "menú",
    steps: (i: InstallIcons): Record<"ios" | "android" | "mac", ReactNode[]> => ({
      ios: [
        <>Toca {b("Compartir")} {i.share} en la barra de Safari (abajo en el iPhone, arriba en el iPad).</>,
        <>Desplázate hacia abajo y toca {b("Añadir a pantalla de inicio")} {i.add}.</>,
        <>Toca {b("Añadir")}. {site.name} ya está en tu pantalla de inicio.</>,
      ],
      android: [
        <>Abre el {b("menú")} {i.menu} del navegador (arriba a la derecha en Chrome, abajo a la derecha en Firefox).</>,
        <>Toca {b("Instalar aplicación")} o {b("Añadir a pantalla de inicio")}.</>,
        <>Confirma. {site.name} ya está con tus otras apps.</>,
      ],
      mac: [
        <>En la barra de menús de Safari, abre {b("Archivo")}.</>,
        <>Elige {b("Añadir al Dock…")}</>,
        <>Haz clic en {b("Añadir")}. {site.name} ya está en tu Dock y en Launchpad.</>,
      ],
    }),
    notes: {
      ios: "¿No usas Safari? Chrome y Edge en el iPhone tienen el mismo botón Compartir. Si no lo ves, abre esta página en Safari.",
      android: "¿No aparece esa opción? Abre esta página en Chrome.",
      mac: "Necesita macOS 14 Sonoma o posterior. En Macs más antiguos, usa Chrome o Edge.",
    },
    sheetTitle: (dock: boolean) => `Añade ${site.name} ${dock ? "al Dock" : "a tu pantalla de inicio"}`,
    gotIt: "Entendido",
    getApp: "Instala la app.",
    worksOffline: " También funciona sin conexión.",
    hide: "Ocultar",
    installed: "Instalada",
    installTheApp: "Instalar la app",
    row: {
      installed: "Estás usando la app instalada.",
      done: `Instalada. Abre ${site.name} desde tu pantalla de inicio o escritorio.`,
      later: "Usa el icono de instalar en la barra de direcciones, o Instalar en el menú del navegador.",
      prompt: "Ábrela desde tu pantalla de inicio o escritorio como cualquier otra app.",
      ios: "Ponla en tu pantalla de inicio y ábrela como cualquier otra app.",
      android: "Ponla en tu pantalla de inicio y ábrela como cualquier otra app.",
      mac: "Ponla en tu Dock y ábrela como cualquier otra app.",
      none: "Este navegador no puede instalar apps. Chrome o Edge sí pueden (en móviles y ordenadores), y Safari en iPhone, iPad y Mac.",
    },
  },

  move: {
    tooOld: "Este navegador es demasiado antiguo para esto. Usa “Descargar copia” más abajo.",
    showQr: "Mostrar código QR",
    enterCode: "Introducir código",
    nothingToSend: "Aún no hay nada que enviar. En el dispositivo desde el que quieres copiar, toca “Mostrar código QR”.",
    whatMoves: "Tus palabras, historial y ajustes. Reemplazan lo que haya en el otro dispositivo.",
    making: "Creando un código…",
    expired: "Este código ha caducado.",
    scan: "Escanéalo con la cámara del otro dispositivo.",
    qrLabel: (code: string) => `Código QR con el enlace a ${site.name} y el código ${code}`,
    orType: `O abre ${site.name} allí, ve a Ajustes → Introducir código:`,
    codeAria: (spaced: string) => `Código ${spaced}`,
    worksFor: (time: string) => `Funciona ${time} más. Hasta entonces tu progreso espera en el servidor de ${site.name}; después se borra.`,
    iphoneNote: `En un iPhone o iPad con ${site.name} en la pantalla de inicio, introduce el código en esa app: la cámara abre Safari, que guarda su propia copia.`,
    makeNew: "Crear un código nuevo",
    getTitle: "Recibe tu progreso",
    getIntro: "En el otro dispositivo: Ajustes → Mostrar código QR. Escribe el código que aparece debajo.",
    code: "Código",
    getting: "Recibiendo…",
    getMine: "Recibir mi progreso",
    badCode: "Un código tiene 8 letras y números, como K7M2-QX9D.",
    offline: "No tienes conexión. Conéctate a internet e inténtalo de nuevo.",
    noServer: `No se pudo conectar con el servidor de ${site.name}. Inténtalo de nuevo en un momento.`,
    wrongCode: "Este código no es correcto o ha caducado (los códigos duran 10 minutos). Crea uno nuevo en el otro dispositivo.",
    broken: "El progreso no llegó completo. Crea un código nuevo e inténtalo otra vez.",
    tooBig: "Esta copia es demasiado grande para enviarla.",
    notSetUp: "Pasar a otro dispositivo aún no está configurado en el servidor.",
  },

  reminder: {
    label: "Recordarme estudiar",
    iosFirst: `En iPhone y iPad, primero instala ${site.name} (Compartir → Añadir a pantalla de inicio) y luego actívalo en la app.`,
    unsupported: "Este navegador no puede mostrar recordatorios. Prueba con Chrome, Edge, Firefox o Safari.",
    on: (time: string) => `Todos los días a las ${time}, salvo que ya hayas estudiado.`,
    off: "Un aviso a la hora que elijas, solo los días que aún no has estudiado.",
    time: "Hora",
    blocked: `Las notificaciones de ${site.name} están bloqueadas. Permítelas en los ajustes del navegador o del móvil.`,
    privacy: `Para enviarlo, el servidor de ${site.name} guarda la dirección de notificaciones de este dispositivo, la hora, tu zona horaria y el último día que estudiaste. Nada más. Al desactivarlo se borran.`,
    noWorker: "Los recordatorios necesitan el modo sin conexión de la app, que no está activo aquí. Recarga la página e inténtalo de nuevo.",
    noServer: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
    switchedOff: "El recordatorio de este dispositivo se desactivó. Vuelve a activarlo.",
    blockedRetry: `Las notificaciones de ${site.name} están bloqueadas. Permítelas en los ajustes del navegador o del móvil e inténtalo de nuevo.`,
    allow: `Toca “Permitir” cuando el navegador te lo pregunte, para que ${site.name} pueda recordártelo.`,
    notSetUp: "Los recordatorios aún no están configurados en el servidor.",
  },

  offline: {
    cantSave: "Este navegador no puede guardar la app para usarla sin conexión.",
    checking: "Comprobando lo que está guardado…",
    checkFailed: "No se pudieron comprobar las pronunciaciones guardadas. ¿Tienes conexión?",
    stopped: "Detenido. Toca otra vez para seguir donde lo dejaste.",
    failed: (n: number) => `${N(n)} no se ${n === 1 ? "pudo" : "pudieron"} guardar (¿se perdió la conexión?). Toca otra vez para reintentar.`,
    title: "Pronunciaciones",
    savedAria: "Pronunciaciones guardadas en este dispositivo",
    stop: "Detener",
    save: (rest: boolean, mb: number) => `Guardar ${rest ? "el resto" : "todas"} sin conexión · unos ${mb} MB`,
    allSaved: "Todo guardado. Todas las palabras suenan sin internet.",
    note: "Las palabras que ya has escuchado se guardan solas. Sin un archivo guardado, la voz de tu dispositivo lee la palabra.",
  },

  backup: {
    notJson: "Este archivo no es una copia de seguridad (no es JSON).",
    newer: "Esta copia se hizo con una versión más nueva de la app. Recarga la página e inténtalo de nuevo.",
    notOurs: `Este archivo no es una copia de seguridad de ${site.name}.`,
  },
};

export default es;
