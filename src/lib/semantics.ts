/**
 * Mapa de conexiones entre palabras para el modo predictivo: qué tiene sentido decir después de
 * cada verbo y qué describe a cada tipo de cosa. Las etiquetas son las categorías del catálogo de
 * carpetas (catalog.ts) más unas especiales. Va dentro de la app: funciona sin conexión y nada sale
 * del dispositivo.
 */

/** Etiquetas especiales (además de las categorías del catálogo: «Comidas», «Lugares»…) */
export const PERSONAS = '@personas' // yo/tú no: mamá, papá, la profe, amigos…
export const VERBOS = '@verbos' // otro verbo en infinitivo: «quiero comer»
export const TODO = '@todo' // cualquier cosa (verbos muy generales: querer, gustar, necesitar…)

const COMER = ['Comidas', 'Frutas', 'Verduras', 'Dulces y postres', 'Cocina y mesa']
const COSAS = ['Juguetes', 'Ropa', 'Casa', 'Cocina y mesa', 'Colegio', 'Aseo e higiene', 'Música e instrumentos', 'Transportes']

/**
 * Verbo (en infinitivo, sin «me»/«se») → qué puede ir después.
 * Si un verbo no está, se considera general (TODO): mejor enseñar de más que impedir decir algo.
 *
 * Revisado con datos reales de conversaciones con niños de CHILDES en español (corpus DiezItza,
 * FernAguado, OreaPine, Ornat, SerraSole: ~238.000 enunciados; TalkBank, CC BY-NC-SA 3.0): para cada
 * verbo se contó de qué va (su objeto o complemento según el análisis sintáctico) y se añadieron las
 * conexiones frecuentes (p. ej. abrir → la boca, tener → el cuerpo: «tengo pupa», ir → al baño, al cole).
 * Las que salen de cuentos («el lobo se come a la oveja») no se añadieron. Ver scripts/childes/frames.py.
 */
export const VERB_FRAMES: Record<string, string[]> = {
  // Generales: cualquier cosa (y otro verbo)
  querer: [TODO, VERBOS],
  necesitar: [TODO, VERBOS],
  gustar: [TODO, VERBOS],
  encantar: [TODO, VERBOS],
  poder: [VERBOS],
  saber: [VERBOS, 'Música e instrumentos', 'Juegos y actividades', 'Colores', 'Números'],
  'tener que': [VERBOS],
  odiar: [TODO, VERBOS],
  preferir: [TODO, VERBOS],
  dejar: [VERBOS, PERSONAS, 'Juguetes', 'Casa'], // «déjame jugar», «deja el coche»
  empezar: [VERBOS, 'Juegos y actividades', 'Colegio'],
  terminar: [VERBOS, 'Juegos y actividades', ...COMER],
  acabar: [VERBOS, 'Juegos y actividades', ...COMER, 'Música e instrumentos'],

  // Comer y beber
  comer: COMER.filter((c) => c !== 'Cocina y mesa'),
  merendar: COMER,
  desayunar: [...COMER, 'Bebidas'],
  cenar: COMER,
  probar: [...COMER, 'Bebidas'],
  morder: [...COMER, 'Juguetes', 'Cuerpo'],
  beber: ['Bebidas'],
  tomar: ['Bebidas', ...COMER, 'Médico y salud'],
  cocinar: COMER,
  cortar: [...COMER, 'Colegio', 'Cuerpo'], // «cortar el pelo, las uñas»
  pelar: ['Frutas', 'Verduras'],

  // Moverse e ir
  ir: [VERBOS, 'Lugares', 'Casa', 'Colegio', PERSONAS, 'Transportes', 'Días y horas'], // «voy al baño, al cole»
  venir: ['Lugares', 'Casa', 'Colegio', PERSONAS, 'Días y horas'],
  volver: [VERBOS, 'Lugares', 'Casa', 'Colegio', 'Transportes', PERSONAS], // «vuelvo a jugar»
  salir: ['Lugares', 'Casa', 'Colegio', 'Naturaleza', PERSONAS],
  entrar: ['Lugares', 'Casa', 'Colegio'],
  llegar: ['Lugares', 'Casa', 'Colegio', 'Días y horas'],
  pasear: ['Lugares', PERSONAS, 'Animales', 'Transportes'],
  viajar: ['Lugares', 'Transportes', PERSONAS],
  quedarse: ['Lugares', 'Casa', 'Colegio', PERSONAS],
  subir: ['Casa', 'Transportes', 'Lugares', 'Juegos y actividades', 'Juguetes'],
  bajar: ['Casa', 'Transportes', 'Lugares', 'Juegos y actividades', 'Juguetes'],
  montar: ['Transportes', 'Animales', 'Juguetes', 'Juegos y actividades'],
  correr: ['Lugares', PERSONAS],
  saltar: ['Lugares', 'Juegos y actividades', 'Casa'],
  nadar: ['Lugares', PERSONAS],
  andar: ['Lugares', 'Juguetes', 'Transportes'], // «andar en bici»
  sentarse: ['Casa', 'Colegio', PERSONAS], // «en la silla», «con mamá»
  volar: ['Transportes', 'Juguetes', 'Animales'],

  // Jugar y hacer cosas
  jugar: ['Juguetes', 'Juegos y actividades', 'Deportes', PERSONAS, 'Lugares'],
  hacer: ['Juegos y actividades', 'Deportes', 'Colegio', 'Formas', 'Comidas', 'Dulces y postres', 'Aseo e higiene'], // «hacer pis»
  pintar: ['Colores', 'Formas', 'Animales', 'Colegio', 'Casa', 'Naturaleza', 'Cuerpo'],
  dibujar: ['Formas', 'Animales', PERSONAS, 'Casa', 'Naturaleza', 'Transportes', 'Colores'],
  colorear: ['Colores', 'Formas', 'Animales'],
  construir: ['Juguetes', 'Casa', 'Formas'],
  leer: ['Colegio', 'Animales', 'Juguetes', 'Juegos y actividades'],
  escribir: ['Colegio', 'Números', PERSONAS, 'Formas'],
  contar: ['Números', 'Juguetes', PERSONAS], // «contar un cuento»
  cantar: ['Música e instrumentos', PERSONAS],
  bailar: ['Música e instrumentos', PERSONAS],
  tocar: ['Música e instrumentos', 'Juguetes', 'Cuerpo', 'Animales', 'Casa'],
  escuchar: ['Música e instrumentos', PERSONAS, 'Animales'],
  oir: ['Música e instrumentos', PERSONAS, 'Animales'],
  ver: ['Juegos y actividades', 'Animales', PERSONAS, 'Casa', 'Lugares', 'Transportes', 'Naturaleza', 'Juguetes'],
  mirar: ['Juegos y actividades', 'Animales', PERSONAS, 'Casa', 'Naturaleza', 'Transportes', 'Colores', 'Juguetes', 'Cuerpo'],
  buscar: [...COSAS, 'Animales', PERSONAS, 'Juguetes'],
  encontrar: [...COSAS, 'Animales', PERSONAS],
  esconder: ['Juguetes', 'Casa', PERSONAS, 'Cuerpo'],
  ganar: ['Juegos y actividades', 'Deportes', PERSONAS],
  perder: ['Juguetes', 'Juegos y actividades', 'Deportes', 'Ropa'],
  tirar: ['Juguetes', 'Juegos y actividades', 'Naturaleza', 'Bebidas'], // «tirar la pelota, piedras»

  // Coger, dar, poner…
  coger: [...COSAS, ...COMER, 'Bebidas', 'Animales', 'Naturaleza'],
  dar: [...COSAS, ...COMER, 'Bebidas', PERSONAS, 'Animales', 'Cuerpo'], // «dar la mano»
  traer: [...COSAS, ...COMER, 'Bebidas', PERSONAS],
  llevar: [...COSAS, 'Ropa', PERSONAS, 'Lugares'],
  recoger: ['Juguetes', 'Casa', 'Ropa', 'Colegio', 'Cocina y mesa'],
  guardar: ['Juguetes', 'Transportes', 'Ropa', 'Colegio', 'Casa'],
  meter: ['Casa', 'Juguetes', 'Transportes', 'Lugares', 'Colegio'],
  sacar: ['Juguetes', 'Transportes', 'Casa', 'Cuerpo', 'Animales'],
  poner: ['Ropa', 'Casa', 'Colegio', 'Cuerpo', 'Cocina y mesa', 'Juguetes', 'Música e instrumentos', 'Juegos y actividades'],
  ponerse: ['Ropa'],
  quitar: ['Ropa', 'Cuerpo', 'Juguetes', 'Casa', 'Cocina y mesa'],
  quitarse: ['Ropa', 'Cuerpo'],
  vestirse: ['Ropa'],
  abrir: ['Casa', 'Cuerpo', 'Juguetes', 'Cocina y mesa', 'Comidas', 'Bebidas', 'Dulces y postres', 'Colegio'], // «abre la boca»
  cerrar: ['Casa', 'Lugares', 'Cuerpo', 'Juguetes', 'Cocina y mesa', 'Colegio'],
  encender: ['Casa', 'Juegos y actividades', 'Música e instrumentos'],
  apagar: ['Casa', 'Juegos y actividades', 'Música e instrumentos'],
  romper: [...COSAS, 'Cuerpo'],
  arreglar: COSAS,
  lavar: ['Cuerpo', 'Ropa', 'Cocina y mesa', 'Aseo e higiene', 'Juguetes'],
  lavarse: ['Cuerpo', 'Aseo e higiene'],
  limpiar: ['Casa', 'Cocina y mesa', 'Juguetes', 'Cuerpo', 'Aseo e higiene'],
  secar: ['Cuerpo', 'Ropa', 'Aseo e higiene'],
  peinar: ['Cuerpo', PERSONAS, 'Animales'],
  peinarse: ['Cuerpo', 'Aseo e higiene'],
  bañar: [PERSONAS, 'Animales', 'Juguetes'],
  bañarse: ['Lugares', 'Deportes', 'Aseo e higiene', PERSONAS], // «en la playa, en la piscina»
  ducharse: ['Aseo e higiene'],
  echar: ['Bebidas', 'Naturaleza', 'Cuerpo', 'Aseo e higiene'], // «echar agua, arena, crema»
  comprar: [...COSAS, ...COMER, 'Bebidas', 'Lugares'],
  usar: [...COSAS, 'Aseo e higiene'],
  tener: [...COSAS, ...COMER, 'Bebidas', 'Animales', 'Cuerpo', 'Sentimientos', 'Médico y salud', PERSONAS], // «tengo pupa, miedo»
  enseñar: [...COSAS, 'Cuerpo', 'Animales', PERSONAS],

  // Personas y relaciones
  llamar: [PERSONAS],
  hablar: [PERSONAS],
  decir: [PERSONAS],
  abrazar: [PERSONAS, 'Animales', 'Juguetes'],
  besar: [PERSONAS, 'Animales'],
  ayudar: [VERBOS, PERSONAS, 'Casa', 'Cocina y mesa'], // «ayúdame a poner»
  esperar: [PERSONAS, 'Transportes', 'Días y horas'],
  visitar: [PERSONAS, 'Lugares'],

  // Cómo estoy
  estar: ['Sentimientos', 'Describir', 'Lugares', 'Casa', 'Médico y salud', PERSONAS],
  ser: ['Describir', 'Colores', 'Formas', 'Profesiones', 'Sentimientos'],
  sentir: ['Sentimientos', 'Médico y salud', 'Cuerpo'],
  sentirse: ['Sentimientos', 'Médico y salud'],
  doler: ['Cuerpo', 'Médico y salud'],
  dormir: ['Lugares', 'Casa', PERSONAS, 'Días y horas'],
  descansar: ['Lugares', 'Casa'],
  despertarse: ['Días y horas'],
  llorar: ['Sentimientos'],
  reír: ['Sentimientos', PERSONAS],
}

/** Qué puede describir a cada tipo de cosa («la pelota roja», «el agua fría») */
export const DESCRIBERS: Record<string, string[]> = {
  Juguetes: ['Colores', 'Describir', 'Formas'],
  Ropa: ['Colores', 'Describir'],
  Transportes: ['Colores', 'Describir'],
  Formas: ['Colores', 'Describir'],
  Animales: ['Describir', 'Colores'],
  Casa: ['Describir', 'Colores'],
  Colegio: ['Colores', 'Describir'],
  Comidas: ['Describir'],
  Frutas: ['Describir'],
  Verduras: ['Describir'],
  'Dulces y postres': ['Describir'],
  Bebidas: ['Describir'],
  'Cocina y mesa': ['Describir', 'Colores'],
  Naturaleza: ['Describir', 'Colores'],
}

/** Palabras que enlazan con lo siguiente («y», «con»…) y qué abren */
export const CONNECTORS: Record<string, string[] | 'same'> = {
  y: 'same', // otra cosa del mismo tipo: «galletas y leche»
  también: 'same',
  con: [PERSONAS, 'Animales', 'Juguetes', 'Cocina y mesa'],
  para: [PERSONAS, 'Animales', 'Lugares'],
  a: ['Lugares', PERSONAS],
  al: ['Lugares'],
  en: ['Lugares', 'Casa', 'Transportes'],
  de: ['Comidas', 'Frutas', 'Colores', PERSONAS, 'Lugares'],
  sin: ['Comidas', 'Frutas', 'Verduras', 'Bebidas', 'Ropa'],
}

/** Tras un nombre, palabras pequeñas que suelen seguir (si están en el tablero) */
export const AFTER_NOUN = ['y', 'con', 'para', 'más', 'también', 'por favor', 'ya', 'otra vez', 'no', 'ahora', 'después']

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const FRAMES_FOLDED = new Map(Object.entries(VERB_FRAMES).map(([k, v]) => [fold(k), v]))

/** Lo que puede ir tras un verbo («gustarme» y «me gusta» cuentan como gustar) */
export function frameFor(verbLabel: string): string[] {
  const v = fold(verbLabel).replace(/^me /, '')
  const candidates = [v, v.replace(/(me|te|se|nos)$/, ''), v.replace(/(me|te|se|nos)$/, 'se'), v.split(/\s+/)[0]]
  for (const c of candidates) {
    const f = FRAMES_FOLDED.get(c)
    if (f) return f
  }
  return [TODO]
}
