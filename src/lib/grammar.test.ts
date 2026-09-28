import { describe, expect, it } from 'vitest'
import { classify, conjugate, lemmatize, pluralize, sentenceText } from './grammar'
import type { Category, CellKind } from './types'

const w = (label: string, category?: Category, kind: CellKind = 'word') => ({
  label,
  category: category ?? classify(label),
  kind,
})
const say = (...labels: string[]) => sentenceText(labels.map((l) => w(l)))

describe('conjugate', () => {
  it.each([
    ['querer', 0, 'quiero'],
    ['querer', 3, 'queremos'],
    ['jugar', 2, 'juega'],
    ['tener', 0, 'tengo'],
    ['tener', 1, 'tienes'],
    ['venir', 5, 'vienen'],
    ['pedir', 0, 'pido'],
    ['dormir', 2, 'duerme'],
    ['conocer', 0, 'conozco'],
    ['recoger', 0, 'recojo'],
    ['construir', 1, 'construyes'],
    ['comer', 4, 'coméis'],
    ['vivir', 3, 'vivimos'],
    ['ir', 0, 'voy'],
    ['seguir', 0, 'sigo'],
    ['elegir', 1, 'eliges'],
    ['acostar', 0, 'acuesto'],
  ] as const)('%s (%i) -> %s', (verb, person, expected) => {
    expect(conjugate(verb, person)).toBe(expected)
  })
})

describe('sentences', () => {
  it('conjugates the first verb and keeps the second as infinitive', () => {
    expect(say('yo', 'querer', 'comer', 'galletas')).toBe('yo quiero comer galletas')
  })
  it('defaults to first person without subject', () => {
    expect(say('querer', 'agua')).toBe('quiero agua')
  })
  it('agrees with the pronoun', () => {
    expect(say('nosotros', 'ir', 'parque')).toBe('nosotros vamos parque')
    expect(say('ella', 'estar', 'contento')).toBe('ella está contento')
  })
  it('handles gustar-like verbs', () => {
    expect(say('yo', 'gustar', 'pizza')).toBe('a mí me gusta pizza')
    expect(say('tú', 'no', 'gustar', 'galletas')).toBe('a ti no te gustan galletas')
    expect(say('doler', 'cabeza')).toBe('me duele cabeza')
    expect(say('mamá', 'gustar', 'playa')).toBe('a mamá le gusta playa')
  })
  it('handles reflexive verbs', () => {
    expect(say('yo', 'ducharse')).toBe('yo me ducho')
    expect(say('yo', 'querer', 'ducharse')).toBe('yo quiero ducharme')
  })
  it('uses people as subject', () => {
    expect(say('papá', 'querer', 'jugar')).toBe('papá quiere jugar')
  })
  it('phrases are spoken as-is', () => {
    expect(sentenceText([w('yo'), w('quiero ir al baño', 'misc', 'phrase')])).toBe('yo quiero ir al baño')
  })
})

describe('lemmatize / classify', () => {
  it('finds the infinitive', () => {
    expect(lemmatize('quiero')).toBe('querer')
    expect(lemmatize('juegan')).toBe('jugar')
    expect(lemmatize('galletas')).toBeNull()
  })
  it('classifies words', () => {
    expect(classify('yo')).toBe('pronoun')
    expect(classify('comer')).toBe('verb')
    expect(classify('lugar')).toBe('noun')
    expect(classify('hola')).toBe('social')
    expect(classify('mamá')).toBe('person')
    expect(classify('contento', 4)).toBe('adjective')
  })
})

describe('parseText', async () => {
  const { parseText } = await import('./generator')
  it('mixes lists, phrases and free text', () => {
    const [b] = parseText('Merienda: quiero comer galletas y beber leche, "no me gusta", más, otra vez')
    expect(b.name).toBe('Merienda')
    expect(b.items.map((i) => `${i.kind}:${i.label}`)).toEqual([
      'word:querer', 'word:comer', 'word:galletas', 'word:beber', 'word:leche',
      'phrase:no me gusta', 'word:más', 'word:otra vez',
    ])
  })
  it('free text line lemmatizes verbs', () => {
    const [b] = parseText('Parque: jugamos en el columpio con mis amigos')
    expect(b.items.map((i) => i.label)).toEqual(['jugar', 'columpio', 'amigos'])
  })
  it('puts every line on the main board unless marked as carpeta', () => {
    const boards = parseText('Merienda: yo, comer\nParque: columpio, comer\ncarpeta Animales: perro, gato\nCarpeta animales: perro, pájaro')
    expect(boards.map((b) => b.name)).toEqual(['Merienda', 'Animales'])
    expect(boards[0].items.map((i) => i.label)).toEqual(['yo', 'comer', 'columpio'])
    expect(boards[1].items.map((i) => i.label)).toEqual(['perro', 'gato', 'pájaro'])
  })
  it('recognises people regardless of accent encoding and proper names', () => {
    expect(classify('papá'.normalize('NFD'))).toBe('person')
    expect(classify('mama')).toBe('person')
    const [b] = parseText('Mati come con papá'.normalize('NFD') + ', Lucía, galletas')
    expect(b.items).toEqual([
      { label: 'Mati', kind: 'word', proper: true },
      { label: 'comer', kind: 'word' },
      { label: 'papá', kind: 'word' },
      { label: 'Lucía', kind: 'word', proper: true },
      { label: 'galletas', kind: 'word' },
    ])
  })
  it('names the main board Inicio without a label', () => {
    expect(parseText('yo, querer, agua')[0].name).toBe('Inicio')
  })
})

describe('pluralize', () => {
  it.each([
    ['casa', 'casas'],
    ['galleta', 'galletas'],
    ['café', 'cafés'],
    ['sofá', 'sofás'],
    ['flor', 'flores'],
    ['color', 'colores'],
    ['ratón', 'ratones'],
    ['camión', 'camiones'],
    ['autobús', 'autobuses'],
    ['lápiz', 'lápices'],
    ['pez', 'peces'],
    ['lunes', 'lunes'],
    ['tren', 'trenes'],
    ['rojo', 'rojos'],
    ['azul', 'azules'],
    ['marrón', 'marrones'],
    ['pan', 'panes'],
    ['coche de bomberos', 'coches de bomberos'],
  ])('%s → %s', (w, p) => expect(pluralize(w)).toBe(p))

  it('plural nouns make gustar-like verbs agree', () => {
    expect(sentenceText([w('yo'), w('gustar'), w('galleta', 'noun')])).toBe('a mí me gusta galleta')
    expect(sentenceText([w('yo'), w('gustar'), w(pluralize('galleta'), 'noun')])).toBe('a mí me gustan galletas')
  })
})
