/**
 * Cuestionario de selección de vocabulario para preescolares que usan CAA (el que se rellena al
 * empezar con un niño nuevo). Cada sección tiene palabras para marcar y preguntas abiertas; con
 * las respuestas se escribe un texto en el formato del creador (`parseText`) que da el tablero
 * principal (vocabulario núcleo) y una carpeta por tema.
 *
 * Las palabras terminadas en «x» (asustadx, nosotrxs) se escriben en masculino o femenino según el niño.
 */

export type Gender = 'nino' | 'nina'

/** Cómo se convierte lo escrito en una pregunta abierta */
export type FieldKind =
  | 'words' // palabras sueltas: «patatas, aceitunas»
  | 'names' // nombres de personas o mascotas: «Mati (hermano), Marina (prima)» -> Mati, Marina
  | 'titles' // títulos tal cual, en una ficha: canciones, cuentos, dibujos, tiendas
  | 'phrases' // expresiones enteras: «oh oh», «me cachis»

export interface Field {
  id: string
  label: string
  placeholder?: string
  kind: FieldKind
  /** Otra carpeta distinta de la de su sección (los nombres de la familia, aparte del principal) */
  target?: string
}

export interface Section {
  id: string
  title: string
  /** Pregunta de la lista de palabras */
  prompt?: string
  words?: string[]
  fields?: Field[]
  /** Dónde van sus fichas: 'main' (tablero principal) o el nombre de la carpeta */
  target: string
}

export const MAIN = 'main'

export const SECTIONS: Section[] = [
  {
    id: 'gente',
    title: 'Gente',
    prompt: 'Palabras que usaría para comunicarse sobre las personas en general',
    words: ['mamá', 'papá', 'niño', 'abuelo', 'abuela', 'niña', 'amigo', 'chico', 'chica'],
    target: MAIN,
    fields: [
      { id: 'familia', target: 'Personas', label: '¿Sobre qué miembros de la familia se comunicaría?', placeholder: 'David (hermano), María (prima), tía Julia', kind: 'names' },
      { id: 'profes', target: 'Personas', label: '¿Sobre qué profesores u otros profesionales?', placeholder: 'cuidadora, profesora de AL, terapeutas…', kind: 'names' },
      { id: 'amigos', target: 'Personas', label: '¿Sobre qué amigos del colegio?', kind: 'names' },
    ],
  },
  {
    id: 'lugares',
    title: 'Lugares',
    prompt: 'Palabras generales para comunicarse sobre los lugares',
    words: ['fuera', 'restaurante', 'parque', 'patio', 'piscina', 'colegio', 'jardín', 'tienda'],
    target: 'Lugares',
    fields: [
      { id: 'tiendas', label: '¿Qué tiendas visita en su día a día?', placeholder: 'Marineda, Gadis, Carrefour', kind: 'titles' },
      { id: 'restaurantes', label: '¿Qué restaurantes visita?', placeholder: "Burger King, McDonald's", kind: 'titles' },
      { id: 'vacaciones', label: '¿Sobre qué sitios de vacaciones querría comunicarse?', placeholder: 'campamento, playa, Madrid', kind: 'words' },
    ],
  },
  {
    id: 'hogar',
    title: 'Actividades en casa',
    prompt: 'Palabras sobre las actividades del hogar',
    words: ['hora del baño', 'merienda', 'tiempo de juego', 'hora de dormir', 'desayuno', 'leer un cuento', 'hora de la siesta', 'hora de comer', 'ver la tele', 'hora de cenar'],
    target: 'Actividades',
    fields: [{ id: 'hogar-otras', label: '¿Alguna actividad concreta en casa sobre la que quiera comunicarse?', placeholder: 'jugar a la tablet, hacer una tarta', kind: 'phrases' }],
  },
  {
    id: 'comunidad',
    title: 'Actividades fuera',
    prompt: 'Palabras sobre las actividades de la comunidad',
    words: ['música', 'biblioteca', 'fútbol', 'gimnasia', 'manualidades', 'cuentacuentos', 'natación', 'baile'],
    target: 'Actividades',
    fields: [{ id: 'eventos', label: '¿Alguna actividad especial o evento social?', placeholder: 'cumpleaños, cabalgatas, fuegos artificiales', kind: 'words' }],
  },
  {
    id: 'cole',
    title: 'Colegio',
    prompt: 'Palabras sobre las actividades (extra)escolares',
    words: ['asamblea', 'excursión', 'siesta', 'hora de AL', 'descanso', 'autobús', 'hora de PT', 'juego libre', 'comedor', 'recreo', 'pintura', 'hora del cuento'],
    target: 'Cole',
    fields: [
      { id: 'cole-otras', label: '¿Alguna actividad concreta del colegio?', placeholder: 'fiesta de carnaval, magosto', kind: 'words' },
      { id: 'asamblea', label: '¿Alguna actividad concreta de la asamblea?', placeholder: 'pasar lista, calendario, el tiempo', kind: 'phrases' },
    ],
  },
  {
    id: 'canciones',
    title: 'Canciones y vídeos',
    target: 'Canciones y vídeos',
    fields: [
      { id: 'canciones', label: '¿Qué canciones le gustan y podrían motivarle a comunicarse?', placeholder: 'El Arca de Noé, Chuchuá', kind: 'titles' },
      { id: 'videos', label: '¿Con qué vídeos o dibujos disfruta?', placeholder: 'Peppa Pig, CantaJuegos, Patrulla Canina', kind: 'titles' },
    ],
  },
  {
    id: 'juguetes',
    title: 'Juguetes',
    prompt: 'Palabras para comunicarse sobre los juguetes',
    words: ['pelota', 'muñeco', 'tren', 'coche', 'puzle', 'moto', 'camión', 'encajables', 'dinosaurio', 'casita de muñecas', 'animales', 'bloques', 'letras', 'cocinita', 'aros'],
    target: 'Juguetes',
    fields: [{ id: 'juguetes-otros', label: '¿Qué juguetes concretos le gustan?', placeholder: 'Señor Patata, Legos, Barbie', kind: 'titles' }],
  },
  {
    id: 'material',
    title: 'Material escolar',
    prompt: 'Palabras sobre los materiales escolares',
    words: ['libro', 'colores', 'tijeras', 'libro para colorear', 'rotuladores', 'pegamento', 'papel', 'pegatina', 'plastilina', 'lápiz', 'mandilón', 'mochila'],
    target: 'Cole',
    fields: [{ id: 'cuentos', label: '¿Sobre qué cuentos concretos se comunicaría?', placeholder: 'Pollo Pepe, Elmer, El Monstruo de Colores', kind: 'titles' }],
  },
  {
    id: 'animales',
    title: 'Animales y mascotas',
    prompt: 'Palabras para referirse a los animales',
    words: ['perro', 'conejo', 'pato', 'gato', 'caballo', 'pájaro', 'vaca', 'cerdo'],
    target: 'Animales',
    fields: [{ id: 'mascotas', label: '¿Hay alguna mascota a su alrededor? Sus nombres', kind: 'names' }],
  },
  {
    id: 'naturaleza',
    title: 'La naturaleza',
    prompt: 'Palabras de la naturaleza',
    words: ['flor', 'cielo', 'lluvia', 'árbol', 'estrellas', 'nube', 'hierba', 'sol', 'luna', 'mar', 'nieve', 'arena'],
    target: 'Naturaleza',
  },
  {
    id: 'casa',
    title: 'Cosas de casa',
    prompt: 'Palabras sobre los objetos de la casa',
    words: ['baño', 'silla', 'televisión', 'orinal', 'cama', 'mesa', 'alfombra', 'asiento de coche', 'ordenador', 'habitación', 'suelo', 'cocina'],
    target: 'Casa',
    fields: [{ id: 'posiciones', label: '¿Qué posiciones pediría que le pusieran?', placeholder: 'sentado en el regazo, a caballito, de pie', kind: 'phrases' }],
  },
  {
    id: 'cuerpo',
    title: 'Partes del cuerpo',
    prompt: 'Palabras sobre las partes del cuerpo',
    words: ['cara', 'cabeza', 'rodilla', 'boca', 'pelo', 'pie', 'dientes', 'brazo', 'dedos', 'nariz', 'mano', 'barriga', 'ojos', 'culo', 'partes íntimas', 'pierna', 'orejas'],
    target: 'Cuerpo',
  },
  {
    id: 'ropa',
    title: 'Ropa',
    prompt: 'Palabras sobre las prendas de vestir',
    words: ['camisa', 'camiseta', 'vaqueros', 'vestido', 'falda', 'zapatos', 'mandilón', 'calcetines', 'jersey', 'abrigo', 'gorro', 'bufanda', 'guantes', 'gafas'],
    target: 'Ropa',
  },
  {
    id: 'comida',
    title: 'Comidas',
    target: 'Comida',
    fields: [
      { id: 'comidas', label: '¿Qué alimentos favoritos tiene?', kind: 'words' },
      { id: 'no-gusta', label: '¿Alguna comida que no le guste y de la que quiera hablar?', kind: 'words' },
    ],
  },
  {
    id: 'bebidas',
    title: 'Bebidas',
    target: 'Bebidas',
    fields: [{ id: 'bebidas', label: '¿Sobre qué bebidas se comunicaría?', placeholder: 'leche, agua', kind: 'words' }],
  },
  {
    id: 'emociones',
    title: 'Emociones',
    prompt: 'Palabras sobre emociones o sentimientos',
    words: ['asustadx', 'enfermx', 'feliz', 'triste', 'hambre', 'cansadx', 'sorprendidx', 'enfadadx', 'dolor', 'sed'],
    target: MAIN,
  },
  {
    id: 'expresiones',
    title: 'Expresiones',
    target: MAIN,
    fields: [{ id: 'expresiones', label: '¿Con qué expresiones se comunica en sus rutinas?', placeholder: 'oh oh, me cachis, qué chulo', kind: 'phrases' }],
  },
  {
    id: 'social',
    title: 'Social y saludos',
    prompt: 'Palabras para saludar o interacciones sencillas',
    words: ['adiós', 'gracias', 'buenas noches', 'por favor', 'hola', 'buenos días'],
    target: MAIN,
    fields: [{ id: 'social-otras', label: '¿Algún otro saludo o expresión del día a día?', kind: 'phrases' }],
  },
  {
    id: 'preguntas',
    title: 'Preguntas',
    prompt: 'Palabras para hacer preguntas',
    words: ['¿quién?', '¿dónde?', '¿por qué?', '¿quién es ese?', '¿cuándo?', '¿por qué no?', '¿qué?', '¿cómo?', '¿qué es eso?', '¿cuándo nos vamos?', '¿falta mucho?'],
    target: MAIN,
  },
  {
    id: 'pronombres',
    title: 'Pronombres',
    prompt: 'Pronombres que podría usar',
    words: ['yo', 'tú', 'él', 'ella', 'nosotrxs', 'vosotrxs', 'ellxs', 'mi', 'mío', 'tu', 'tuyo', 'su', 'suyo'],
    target: MAIN,
  },
  {
    id: 'verbos',
    title: 'Verbos',
    prompt: 'Verbos que podría necesitar en su día a día',
    words: ['ir', 'parar', 'leer', 'cerrar', 'dormir', 'correr', 'venir', 'sentarse', 'jugar', 'pintar', 'dar', 'poner', 'girar', 'mirar', 'hablar', 'caminar', 'salir', 'pasear', 'escuchar', 'abrir', 'querer', 'saber'],
    target: MAIN,
    fields: [{ id: 'verbos-otros', label: 'Otros verbos', kind: 'words' }],
  },
  {
    id: 'descriptores',
    title: 'Descriptores',
    prompt: 'Palabras para describir las cosas de su entorno',
    words: ['grande', 'corto', 'feo', 'poco', 'largo', 'bonito', 'mucho', 'alto', 'viejo', 'más', 'bajo', 'divertido', 'bueno', 'limpio', 'aburrido', 'malo', 'sucio', 'igual', 'enfermx', 'aquí', 'diferente', 'caliente', 'allí', 'horrible', 'frío', 'lejos', 'guay'],
    target: MAIN,
    fields: [{ id: 'descriptores-otros', label: 'Otros descriptores', kind: 'words' }],
  },
]

/** Orden en que se escriben los grupos del tablero principal (las zonas las coloca el generador) */
const MAIN_ORDER = ['pronombres', 'gente', 'preguntas', 'verbos', 'descriptores', 'emociones', 'social', 'expresiones']

export interface Answers {
  name: string
  gender: Gender
  /** Palabras marcadas por sección (tal cual aparecen en `words`) */
  checked: Record<string, string[]>
  /** Lo escrito en cada pregunta abierta, por id */
  fields: Record<string, string>
  /** Palabras que el niño dice de otra forma: «tren» -> «chu-chu» */
  renamed?: Record<string, string>
}

export function emptyAnswers(): Answers {
  return { name: '', gender: 'nino', checked: {}, fields: {}, renamed: {} }
}

/** «asustadx» -> asustado / asustada; «nosotrxs» -> nosotros / nosotras */
export function inflect(word: string, gender: Gender): string {
  return word.replace(/x(s?)$/u, (_, s: string) => (gender === 'nina' ? 'a' : 'o') + s)
}

/**
 * Texto libre -> trozos: separa por comas, punto y coma y saltos de línea; quita los paréntesis.
 * Con `loose` también por « y » y « - » (listas de nombres o palabras; no en títulos como «Tom y Jerry»).
 */
export function splitFree(text: string, loose = true): string[] {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .split(loose ? /[,;\n]|\s+[-–—]\s+|\s+y\s+/u : /[,;\n]/u)
    .map((s) => s.replace(/\.{2,}|…/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Lo que no puede ir dentro de un trozo del texto del creador */
const clean = (s: string) => s.replace(/["“”#:,]/g, '').replace(/\s+/g, ' ').trim()

/** Una ficha en el formato del creador: entre comillas va entera en una celda (y respeta mayúsculas) */
function item(label: string, opts: { whole?: boolean } = {}): string {
  const l = clean(label)
  if (!l) return ''
  // Tres palabras o más sin comillas se tomarían como texto libre y se partirían
  return opts.whole || l.split(' ').length >= 3 ? `"${l}"` : l
}

function fieldItems(field: Field, text: string): string[] {
  const whole = field.kind === 'titles' || field.kind === 'phrases'
  return splitFree(text, !whole).map((part) => {
    if (whole) return item(part, { whole: true })
    if (field.kind === 'names') {
      const n = clean(part)
      // Un nombre de una palabra: con mayúscula, para que sea una persona sin pictograma aproximado
      if (!n.includes(' ')) return n.charAt(0).toLocaleUpperCase('es') + n.slice(1)
      return item(n, { whole: true })
    }
    return item(part)
  })
}

function wordItem(sectionId: string, word: string, a: Answers): string {
  const renamed = a.renamed?.[`${sectionId}:${word}`]?.trim()
  if (renamed) return item(renamed)
  const w = inflect(word, a.gender)
  if (sectionId === 'preguntas') {
    // Una sola palabra se combina en la frase («¿dónde?» -> dónde); una pregunta hecha va entera
    const bare = w.replace(/[¿?]/g, '').trim()
    return bare.includes(' ') ? `"${w}"` : bare
  }
  return item(w)
}

/** Fichas de una sección, cada una con su destino ('main' o el nombre de la carpeta) */
function sectionItems(s: Section, a: Answers): { target: string; item: string }[] {
  const words = (s.words ?? []).filter((w) => a.checked[s.id]?.includes(w)).map((w) => ({ target: s.target, item: wordItem(s.id, w, a) }))
  const free = (s.fields ?? []).flatMap((f) => fieldItems(f, a.fields[f.id] ?? '').map((item) => ({ target: f.target ?? s.target, item })))
  return [...words, ...free].filter((x) => x.item)
}

/** Cuántas fichas saldrían de una sección (para el índice del asistente) */
export function sectionCount(s: Section, a: Answers): number {
  return sectionItems(s, a).length
}

/**
 * Respuestas -> texto del creador. La primera línea da nombre al tablero principal («Inicio»);
 * cada tema es una línea «carpeta Nombre: …» (varias secciones con la misma carpeta se juntan).
 */
export function answersToText(a: Answers): string {
  const rank = (s: Section) => (s.target === MAIN ? MAIN_ORDER.indexOf(s.id) : MAIN_ORDER.length)
  const all = [...SECTIONS].sort((x, y) => rank(x) - rank(y)).flatMap((s) => sectionItems(s, a))
  const main = all.filter((x) => x.target === MAIN).map((x) => x.item)
  // Carpetas en el orden del cuestionario
  const folders = new Map<string, string[]>()
  for (const { target, item } of SECTIONS.flatMap((s) => sectionItems(s, a))) {
    if (target !== MAIN) folders.set(target, [...(folders.get(target) ?? []), item])
  }
  const lines = [`# Cuestionario de vocabulario${a.name.trim() ? ` de ${clean(a.name)}` : ''}`, `Inicio: ${main.join(', ')}`]
  for (const [name, items] of folders) lines.push(`carpeta ${name}: ${items.join(', ')}`)
  return lines.join('\n')
}
