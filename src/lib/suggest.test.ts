import { describe, expect, it } from 'vitest'
import { FOLDER_CATALOG } from './catalog'
import { _setWordsForTest, suggestWords } from './suggest'

describe('suggestWords', () => {
  _setWordsForTest(['plátano', 'plato', 'platanero', 'plataforma', 'lavarse los dientes', 'pasta de dientes', '00:15h', ' cobaya', 'Platón'])

  it('encuentra sin tildes y pone primero las palabras habituales del catálogo', () => {
    const s = suggestWords('plat')
    expect(s.slice(0, 2)).toEqual(['plato', 'plátano']) // del catálogo, las más cortas primero
    expect(s).toContain('plataforma')
  })
  it('también por una palabra del medio', () => {
    expect(suggestWords('dientes')).toEqual(expect.arrayContaining(['lavarse los dientes', 'pasta de dientes']))
  })
  it('descarta horas, símbolos y entradas con espacios delante', () => {
    expect(suggestWords('00')).toEqual([])
    expect(suggestWords('coba')).toEqual([])
  })
  it('no sugiere lo ya escrito ni lo excluido', () => {
    expect(suggestWords('plato')).not.toContain('plato')
    expect(suggestWords('plat', 8, ['plátano'])).not.toContain('plátano')
  })
})

describe('catálogo de carpetas', () => {
  it('tiene muchas categorías con bastantes palabras, sin repetir dentro de cada una', () => {
    expect(Object.keys(FOLDER_CATALOG).length).toBeGreaterThanOrEqual(25)
    for (const [name, words] of Object.entries(FOLDER_CATALOG)) {
      expect(words.length, name).toBeGreaterThanOrEqual(9)
      expect(new Set(words).size, name).toBe(words.length)
    }
  })
})
