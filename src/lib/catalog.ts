/**
 * Vocabulario para las carpetas de categorías. No se mete entero: al crear la carpeta se eligen
 * las palabras que interesan (una categoría como «Comidas» no tiene fin). Palabras con
 * pictograma en ARASAAC y en castellano de España.
 */
export const FOLDER_CATALOG: Record<string, string[]> = {
  Animales: [
    'perro', 'gato', 'pájaro', 'pez', 'caballo', 'vaca', 'cerdo', 'oveja', 'cabra', 'gallina', 'pollito', 'gallo',
    'pato', 'conejo', 'ratón', 'burro', 'león', 'tigre', 'elefante', 'jirafa', 'mono', 'cebra', 'hipopótamo',
    'rinoceronte', 'oso', 'lobo', 'zorro', 'ardilla', 'erizo', 'tortuga', 'serpiente', 'cocodrilo', 'rana', 'mariposa',
    'abeja', 'hormiga', 'mariquita', 'araña', 'caracol', 'búho', 'loro', 'pingüino', 'delfín', 'ballena', 'tiburón',
    'pulpo', 'cangrejo', 'medusa', 'foca', 'dinosaurio', 'unicornio',
  ],
  Comidas: [
    'pan', 'galletas', 'cereales', 'tostada', 'bocadillo', 'sándwich', 'magdalena', 'yogur', 'queso', 'jamón', 'huevo',
    'tortilla', 'pasta', 'macarrones', 'espaguetis', 'arroz', 'paella', 'sopa', 'lentejas', 'garbanzos', 'pizza',
    'hamburguesa', 'salchicha', 'patatas fritas', 'pollo', 'carne', 'pescado', 'albóndigas', 'croquetas', 'ensalada',
    'puré', 'empanada', 'mantequilla', 'mermelada', 'aceite', 'sal', 'kétchup',
  ],
  Frutas: [
    'fruta', 'manzana', 'plátano', 'naranja', 'mandarina', 'pera', 'fresa', 'uvas', 'sandía', 'melón', 'piña', 'melocotón',
    'cerezas', 'kiwi', 'limón', 'mango', 'ciruela', 'albaricoque', 'frambuesa', 'higo', 'aguacate', 'coco',
  ],
  Verduras: [
    'verdura', 'patata', 'tomate', 'zanahoria', 'lechuga', 'pepino', 'cebolla', 'ajo', 'pimiento', 'calabacín', 'berenjena',
    'brócoli', 'coliflor', 'guisantes', 'judías verdes', 'maíz', 'espinacas', 'calabaza', 'champiñón', 'alcachofa',
  ],
  Bebidas: ['agua', 'leche', 'zumo', 'batido', 'cacao', 'colacao', 'refresco', 'limonada', 'infusión', 'café', 'té', 'caldo'],
  'Dulces y postres': [
    'helado', 'chocolate', 'caramelo', 'chuches', 'piruleta', 'chicle', 'tarta', 'bizcocho', 'donut', 'churros', 'flan',
    'natillas', 'gominolas', 'palomitas', 'gofre', 'tortitas', 'cruasán', 'napolitana',
  ],
  Colores: ['rojo', 'azul', 'amarillo', 'verde', 'naranja', 'rosa', 'morado', 'marrón', 'negro', 'blanco', 'gris', 'dorado', 'plateado', 'celeste'],
  Formas: ['círculo', 'cuadrado', 'triángulo', 'rectángulo', 'estrella', 'corazón', 'rombo', 'óvalo', 'línea'],
  Números: ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'cero', 'muchos', 'pocos'],
  Juguetes: [
    'pelota', 'muñeca', 'coche', 'puzle', 'bloques', 'construcciones', 'peluche', 'tren', 'globo', 'pinturas', 'plastilina',
    'libro', 'cuento', 'tablet', 'burbujas', 'cometa', 'patinete', 'bicicleta', 'patines', 'cubo', 'pala', 'dados',
    'cartas', 'pompas', 'marioneta', 'tambor', 'xilófono', 'peonza', 'yoyó', 'robot', 'avión', 'barco', 'moto',
  ],
  'Juegos y actividades': [
    'jugar', 'pintar', 'dibujar', 'colorear', 'recortar', 'pegar', 'leer', 'cantar', 'bailar', 'correr', 'saltar', 'nadar',
    'escondite', 'pilla pilla', 'columpio', 'tobogán', 'arenero', 'parque', 'música', 'tele', 'película', 'ordenador',
    'videojuego', 'cocinar', 'pasear', 'hacer puzles', 'jugar a la pelota', 'ver dibujos',
  ],
  Deportes: [
    'fútbol', 'baloncesto', 'natación', 'tenis', 'balonmano', 'voleibol', 'ciclismo', 'atletismo', 'gimnasia', 'judo',
    'kárate', 'patinaje', 'esquí', 'pádel', 'hípica', 'equitación', 'rugby', 'golf', 'balón', 'raqueta', 'portería', 'piscina',
  ],
  Ropa: [
    'camiseta', 'pantalón', 'falda', 'vestido', 'jersey', 'sudadera', 'abrigo', 'chaqueta', 'chándal', 'pijama', 'calcetines',
    'zapatos', 'zapatillas', 'botas', 'sandalias', 'chanclas', 'braga', 'calzoncillo', 'gorro', 'gorra', 'bufanda',
    'guantes', 'bañador', 'babero', 'pañal', 'mochila', 'gafas',
  ],
  Cuerpo: [
    'cabeza', 'pelo', 'cara', 'ojos', 'nariz', 'boca', 'dientes', 'lengua', 'orejas', 'cuello', 'hombro', 'brazo', 'codo',
    'mano', 'dedos', 'uña', 'barriga', 'espalda', 'culo', 'pierna', 'rodilla', 'pie', 'tripa', 'pecho', 'garganta',
  ],
  'Aseo e higiene': [
    'baño', 'váter', 'pis', 'caca', 'lavar las manos', 'jabón', 'toalla', 'ducha', 'bañera', 'bañarse', 'cepillo de dientes',
    'pasta de dientes', 'lavarse los dientes', 'peine', 'peinarse', 'champú', 'papel higiénico', 'pañuelo', 'sonarse',
    'crema', 'colonia', 'cortar las uñas', 'secador',
  ],
  Casa: [
    'casa', 'habitación', 'cocina', 'salón', 'baño', 'jardín', 'terraza', 'puerta', 'ventana', 'cama', 'mesa', 'silla',
    'sofá', 'armario', 'estantería', 'lámpara', 'luz', 'televisión', 'nevera', 'horno', 'microondas', 'lavadora',
    'llave', 'escalera', 'ascensor', 'almohada', 'manta', 'cortina',
  ],
  'Cocina y mesa': ['plato', 'vaso', 'taza', 'cuchara', 'tenedor', 'cuchillo', 'servilleta', 'botella', 'biberón', 'pajita', 'olla', 'sartén', 'mantel', 'bandeja'],
  Lugares: [
    'casa', 'colegio', 'parque', 'playa', 'piscina', 'montaña', 'campo', 'ciudad', 'calle', 'tienda', 'supermercado',
    'mercado', 'panadería', 'restaurante', 'cafetería', 'hospital', 'centro de salud', 'farmacia', 'biblioteca', 'cine',
    'teatro', 'museo', 'zoo', 'granja', 'iglesia', 'polideportivo', 'gimnasio', 'peluquería', 'estación', 'aeropuerto',
    'casa de los abuelos', 'terapia', 'logopeda',
  ],
  Transportes: [
    'coche', 'autobús', 'tren', 'metro', 'tranvía', 'avión', 'helicóptero', 'barco', 'bicicleta', 'moto', 'patinete',
    'taxi', 'camión', 'furgoneta', 'ambulancia', 'coche de policía', 'camión de bomberos', 'tractor', 'grúa', 'cohete',
    'globo aerostático', 'caminar',
  ],
  Naturaleza: [
    'árbol', 'flor', 'planta', 'hoja', 'hierba', 'piedra', 'arena', 'tierra', 'agua', 'río', 'mar', 'lago', 'montaña',
    'bosque', 'playa', 'sol', 'luna', 'estrella', 'cielo', 'nube', 'fuego', 'concha', 'seta', 'rama',
  ],
  'El tiempo': ['sol', 'lluvia', 'nube', 'viento', 'nieve', 'tormenta', 'rayo', 'niebla', 'arcoíris', 'calor', 'frío', 'paraguas', 'charco'],
  'Días y horas': [
    'hoy', 'mañana', 'ayer', 'ahora', 'después', 'antes', 'luego', 'pronto', 'tarde', 'noche', 'día', 'semana', 'fin de semana',
    'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo', 'cumpleaños', 'vacaciones', 'Navidad',
    'desayuno', 'comida', 'merienda', 'cena', 'hora de dormir',
  ],
  'Familia y personas': [
    'mamá', 'papá', 'hermano', 'hermana', 'abuelo', 'abuela', 'tío', 'tía', 'primo', 'prima', 'bebé', 'niño', 'niña',
    'amigo', 'amiga', 'familia', 'profesor', 'profesora', 'compañeros', 'vecino', 'chico', 'chica', 'señor', 'señora',
  ],
  Profesiones: [
    'médico', 'enfermera', 'dentista', 'profesor', 'logopeda', 'fisioterapeuta', 'psicólogo', 'policía', 'bombero',
    'cocinero', 'camarero', 'panadero', 'peluquero', 'conductor', 'piloto', 'agricultor', 'veterinario', 'cartero',
    'mecánico', 'pintor', 'dependiente', 'socorrista',
  ],
  Sentimientos: [
    'contento', 'triste', 'enfadado', 'asustado', 'cansado', 'aburrido', 'nervioso', 'tranquilo', 'sorprendido',
    'preocupado', 'avergonzado', 'celoso', 'orgulloso', 'feliz', 'enfermo', 'dolor', 'hambre', 'sed', 'sueño', 'miedo',
    'calor', 'frío', 'me gusta', 'no me gusta',
  ],
  Describir: [
    'grande', 'pequeño', 'alto', 'bajo', 'largo', 'corto', 'gordo', 'delgado', 'nuevo', 'viejo', 'limpio', 'sucio',
    'caliente', 'frío', 'rápido', 'lento', 'fácil', 'difícil', 'bonito', 'feo', 'rico', 'asco', 'blando', 'duro',
    'mojado', 'seco', 'lleno', 'vacío', 'abierto', 'cerrado', 'roto', 'igual', 'diferente',
  ],
  Colegio: [
    'colegio', 'clase', 'profesor', 'compañeros', 'patio', 'recreo', 'comedor', 'mochila', 'estuche', 'lápiz', 'goma',
    'sacapuntas', 'tijeras', 'pegamento', 'cuaderno', 'libro', 'ficha', 'pizarra', 'mesa', 'silla', 'rotulador',
    'regla', 'deberes', 'excursión', 'autobús escolar', 'gimnasio', 'fila',
  ],
  'Médico y salud': [
    'médico', 'enfermera', 'hospital', 'centro de salud', 'medicina', 'jarabe', 'pastilla', 'tirita', 'vacuna', 'termómetro',
    'fiebre', 'tos', 'dolor', 'herida', 'sangre', 'vómito', 'mocos', 'dolor de cabeza', 'dolor de barriga', 'dolor de oídos',
    'ambulancia', 'curar',
  ],
  'Música e instrumentos': [
    'música', 'canción', 'cantar', 'bailar', 'piano', 'guitarra', 'tambor', 'flauta', 'violín', 'trompeta', 'xilófono',
    'pandereta', 'maracas', 'triángulo', 'batería', 'micrófono', 'auriculares', 'altavoz', 'más alto', 'más bajo',
  ],
  Acciones: [
    'comer', 'beber', 'dormir', 'jugar', 'ir', 'venir', 'querer', 'dar', 'coger', 'abrir', 'cerrar', 'poner', 'quitar',
    'mirar', 'escuchar', 'hablar', 'decir', 'ayudar', 'esperar', 'parar', 'terminar', 'empezar', 'lavar', 'vestir',
    'sentar', 'levantar', 'subir', 'bajar', 'entrar', 'salir', 'buscar', 'encontrar', 'tocar', 'romper', 'arreglar',
    'hacer', 'tener', 'gustar', 'necesitar', 'pensar', 'saber', 'aprender', 'llorar', 'reír', 'besar', 'abrazar',
  ],
}

/** Todas las palabras del catálogo (sin repetir), para priorizarlas en las sugerencias. */
export const CATALOG_WORDS: string[] = [...new Set(Object.values(FOLDER_CATALOG).flat())]

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * Categoría del catálogo que corresponde a una carpeta: por su nombre («Animales», «comida»…)
 * o, si no, por las palabras que ya tiene (al menos 2 en común). null si no se parece a ninguna.
 */
export function categoryFor(folderName: string, labels: string[]): string | null {
  const name = fold(folderName)
  const keys = Object.keys(FOLDER_CATALOG)
  const byName =
    keys.find((k) => fold(k) === name) ??
    keys.find((k) => {
      const key = fold(k)
      // «comida» ~ «Comidas», «animal» ~ «Animales», «ropa y zapatos» ~ «Ropa»
      return key.startsWith(name) || name.startsWith(key) || key.split(/\s+/)[0] === name.split(/\s+/)[0]
    })
  if (byName) return byName
  const have = new Set(labels.map(fold))
  let best: { key: string; n: number } | null = null
  for (const k of keys) {
    const n = FOLDER_CATALOG[k].filter((w) => have.has(fold(w))).length
    if (n >= 2 && (!best || n > best.n)) best = { key: k, n }
  }
  return best?.key ?? null
}

/** Palabras de la categoría que aún no están en la carpeta */
export function missingWords(category: string, labels: string[]): string[] {
  const have = new Set(labels.map(fold))
  return (FOLDER_CATALOG[category] ?? []).filter((w) => !have.has(fold(w)))
}
