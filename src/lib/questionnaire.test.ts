import { describe, expect, it } from 'vitest'
import { parseText } from './generator'
import { answersToText, emptyAnswers, inflect, splitFree } from './questionnaire'

const sample = () => ({
  ...emptyAnswers(),
  name: 'Leo',
  checked: {
    gente: ['mamá', 'papá'],
    pronombres: ['yo', 'nosotrxs'],
    verbos: ['querer', 'ir'],
    emociones: ['cansadx', 'feliz'],
    preguntas: ['¿dónde?', '¿qué es eso?'],
    hogar: ['hora del baño', 'merienda'],
    juguetes: ['pelota', 'tren'],
    animales: ['perro'],
  },
  fields: {
    familia: 'Hugo (hermano), tía Rosa',
    mascotas: 'Toby',
    canciones: 'Tom y Jerry, Los Lunnis',
    bebidas: 'leche y agua',
    expresiones: 'oh oh, me cachis',
  },
  renamed: { 'juguetes:tren': 'chu-chu' },
})

describe('cuestionario -> tablero', () => {
  it('inflexiona las palabras en «x»', () => {
    expect(inflect('cansadx', 'nino')).toBe('cansado')
    expect(inflect('cansadx', 'nina')).toBe('cansada')
    expect(inflect('nosotrxs', 'nina')).toBe('nosotras')
    expect(inflect('caballo', 'nina')).toBe('caballo')
  })

  it('parte el texto libre y quita los paréntesis', () => {
    expect(splitFree('Hugo (hermano), Ana y Luis - Toby')).toEqual(['Hugo', 'Ana', 'Luis', 'Toby'])
    expect(splitFree('comer algo (patatas, nueces...), jugar')).toEqual(['comer algo', 'jugar'])
    expect(splitFree('Tom y Jerry', false)).toEqual(['Tom y Jerry'])
  })

  it('núcleo en el principal y una carpeta por tema', () => {
    const boards = parseText(answersToText(sample()))
    const [main, ...folders] = boards
    expect(main.name).toBe('Inicio')
    const labels = main.items.map((i) => i.label)
    expect(labels).toEqual(expect.arrayContaining(['yo', 'nosotros', 'querer', 'ir', 'cansado', 'feliz', 'dónde', 'mamá', 'oh oh']))
    expect(main.items.find((i) => i.label === '¿qué es eso?')?.kind).toBe('phrase')
    expect(main.items.find((i) => i.label === 'me cachis')?.kind).toBe('phrase')

    const byName = Object.fromEntries(folders.map((f) => [f.name, f.items]))
    expect(Object.keys(byName)).toEqual(['Personas', 'Actividades', 'Canciones y vídeos', 'Juguetes', 'Animales', 'Bebidas'])
    expect(byName.Actividades.map((i) => i.label)).toEqual(['hora del baño', 'merienda'])
    expect(byName.Juguetes.map((i) => i.label)).toEqual(['pelota', 'chu-chu'])
    expect(byName['Canciones y vídeos'].map((i) => i.label)).toEqual(['Tom y Jerry', 'Los Lunnis'])
    expect(byName.Animales).toContainEqual(expect.objectContaining({ label: 'Toby', proper: true }))
    expect(byName.Bebidas.map((i) => i.label)).toEqual(['leche', 'agua'])
  })

  it('las personas con nombre van a la carpeta Personas como nombres propios', () => {
    const personas = parseText(answersToText(sample())).find((b) => b.name === 'Personas')!
    expect(personas.items).toContainEqual(expect.objectContaining({ label: 'Hugo', proper: true }))
    expect(personas.items.find((i) => i.label === 'tía Rosa')).toBeTruthy()
  })

  it('sin respuestas no hay carpetas', () => {
    const boards = parseText(answersToText(emptyAnswers()))
    expect(boards).toHaveLength(1)
    expect(boards[0].items).toHaveLength(0)
  })
})

describe('cuestionarios en el servidor', async () => {
  const { progressOf, toAnswers, tokenFromPath } = await import('./questionnaires')
  const token = 'a'.repeat(32) + '0123456789abcdef'.repeat(2)
  it('reconoce el enlace del tutor', () => {
    expect(tokenFromPath(`/cuestionario/${token}`)).toBe(token)
    expect(tokenFromPath(`/cuestionario/${token}/`)).toBe(token)
    expect(tokenFromPath('/cuestionario/corto')).toBeNull()
    expect(tokenFromPath('/')).toBeNull()
  })
  it('completa las respuestas guardadas y usa el nombre del niño', () => {
    const a = toAnswers({ checked: { gente: ['mamá'] } }, 'Leo')
    expect(a).toMatchObject({ name: 'Leo', gender: 'nino', checked: { gente: ['mamá'] }, fields: {}, renamed: {} })
  })
  it('sin empezar, a medias o enviado', () => {
    expect(progressOf({ status: 'pendiente', answers: { name: 'Leo' } })).toBe('sin empezar')
    expect(progressOf({ status: 'pendiente', answers: { fields: { bebidas: ' agua' } } })).toBe('a medias')
    expect(progressOf({ status: 'enviado', answers: {} })).toBe('enviado')
  })
})
