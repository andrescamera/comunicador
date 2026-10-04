import { describe, expect, it } from 'vitest'
import { buildPool, DEFAULT_DYNAMIC, predictCells, predictiveHighlights } from './predict'
import type { Board, Category, Cell, Library } from './types'

let n = 0
const w = (label: string, category: Category, kind: Cell['kind'] = 'word', target?: string): Cell => ({
  id: `c${n++}`, label, category, kind, target, row: n % 6, col: Math.floor(n / 6),
})
const board = (id: string, name: string, cells: Cell[], rows = 6, cols = 10): Board => ({
  id, name, rows, cols, zones: { A: [0, 1], B: [2, 4], C: [5, 6], D: [7, 8], E: [9, 9] }, cells,
})

const yo = w('yo', 'pronoun'), tu = w('tú', 'pronoun'), mama = w('mamá', 'person'), donde = w('dónde', 'question')
const querer = w('querer', 'verb'), comer = w('comer', 'verb'), ir = w('ir', 'verb'), jugar = w('jugar', 'verb'), beber = w('beber', 'verb'), estar = w('estar', 'verb')
const y = w('y', 'misc'), con = w('con', 'misc'), grande = w('grande', 'adjective'), hola = w('hola', 'social')
const no = w('no', 'negation'), si = w('sí', 'social'), mas = w('más', 'misc'), ayuda = w('ayuda', 'social')
const agua = w('agua', 'noun'), contento = w('contento', 'adjective')
const galletas = w('galletas', 'noun'), platano = w('plátano', 'noun'), cruasan = w('cruasán de chocolate', 'noun') // fuera del catálogo
const parque = w('parque', 'noun'), casa = w('casa', 'noun'), colegio = w('colegio', 'noun')
const pelota = w('pelota', 'noun'), rojo = w('rojo', 'adjective'), azul = w('azul', 'adjective'), futbol = w('fútbol', 'noun')

const lib: Library = {
  rootId: 'root',
  boards: {
    root: board('root', 'Inicio', [
      yo, tu, mama, donde, querer, comer, ir, jugar, beber, estar, y, con, grande, hola, no, si, mas, ayuda, agua, contento,
      w('Comida', 'misc', 'folder', 'f-comida'), w('Lugares', 'misc', 'folder', 'f-lugares'), w('Juguetes', 'misc', 'folder', 'f-juguetes'),
      w('Colores', 'misc', 'folder', 'f-colores'), w('Deportes', 'misc', 'folder', 'f-deportes'),
    ]),
    'f-comida': board('f-comida', 'Comida', [galletas, platano, cruasan, w('zumo', 'noun')]),
    'f-lugares': board('f-lugares', 'Lugares', [parque, casa, colegio]),
    'f-juguetes': board('f-juguetes', 'Juguetes', [pelota]),
    'f-colores': board('f-colores', 'Colores', [rojo, azul]),
    'f-deportes': board('f-deportes', 'Deportes', [futbol]),
  },
}
const predict = (...s: Cell[]) => predictCells(lib, DEFAULT_DYNAMIC, s).map((c) => c.label)

describe('modo predictivo', () => {
  it('las palabras de dentro de las carpetas heredan su tipo (también las que no están en el catálogo)', () => {
    const pool = buildPool(lib)
    expect([...pool.find((p) => p.cell === cruasan)!.tags]).toContain('Comidas')
    expect(pool.some((p) => p.cell.kind === 'folder')).toBe(false)
  })

  it('al empezar: personas, preguntas, verbos y social; sin nombres ni la columna fija', () => {
    const s = predict()
    expect(s).toEqual(expect.arrayContaining(['yo', 'mamá', 'dónde', 'comer', 'hola']))
    expect(s).not.toContain('galletas')
    expect(s).not.toContain('no')
  })

  it('tras «yo»: solo verbos', () => {
    expect(predict(yo).sort()).toEqual(['beber', 'comer', 'estar', 'ir', 'jugar', 'querer'])
  })

  it('tras «comer»: comidas (también de la carpeta), nunca lugares ni deportes', () => {
    const s = predict(yo, comer)
    expect(s).toEqual(expect.arrayContaining(['galletas', 'plátano', 'cruasán de chocolate']))
    for (const nope of ['casa', 'parque', 'fútbol', 'pelota', 'agua', 'mamá']) expect(s).not.toContain(nope)
  })

  it('tras «beber»: bebidas (también el zumo guardado en la carpeta Comida)', () => {
    expect(predict(yo, beber).sort()).toEqual(['agua', 'zumo'])
    expect(predict(yo, comer)).not.toContain('zumo')
  })

  it('tras «ir»: lugares y personas (y verbos: «voy a jugar»)', () => {
    const s = predict(yo, ir)
    expect(s).toEqual(expect.arrayContaining(['parque', 'casa', 'colegio', 'mamá', 'jugar']))
    expect(s).not.toContain('galletas')
  })

  it('tras «jugar»: juguetes, deportes y personas', () => {
    const s = predict(yo, jugar)
    expect(s).toEqual(expect.arrayContaining(['pelota', 'fútbol', 'mamá']))
    expect(s).not.toContain('galletas')
  })

  it('tras «quiero»: otros verbos y cualquier cosa', () => {
    const s = predict(yo, querer)
    expect(s).toEqual(expect.arrayContaining(['comer', 'jugar', 'galletas', 'pelota', 'parque']))
  })

  it('tras «quiero comer»: solo comidas', () => {
    const s = predict(yo, querer, comer)
    expect(s).toContain('galletas')
    expect(s).not.toContain('jugar')
    expect(s).not.toContain('parque')
  })

  it('tras «estar»: cómo me siento', () => {
    expect(predict(yo, estar)).toEqual(expect.arrayContaining(['contento', 'grande']))
  })

  it('tras un nombre: lo que lo describe y enlaces («la pelota roja», «galletas y…»)', () => {
    const s = predict(yo, jugar, pelota)
    expect(s).toEqual(expect.arrayContaining(['rojo', 'azul', 'grande', 'y', 'con']))
    expect(s).not.toContain('parque')
  })

  it('tras «y»: otra cosa del mismo tipo; tras «con»: personas', () => {
    expect(predict(yo, comer, galletas, y)).toEqual(expect.arrayContaining(['plátano']))
    expect(predict(yo, comer, galletas, y)).not.toContain('casa')
    expect(predict(yo, jugar, pelota, con)).toContain('mamá')
  })

  it('nada cambia de sitio: solo se resalta lo que encaja (y las palabras fijas)', () => {
    const { lit } = predictiveHighlights(lib, DEFAULT_DYNAMIC, [yo])
    expect(lit.has(comer.id)).toBe(true)
    expect(lit.has(no.id) && lit.has(ayuda.id)).toBe(true)
    expect(lit.has(agua.id)).toBe(false)
  })

  it('tras «comer»: se abre sola la carpeta Comida (todo lo que encaja está ahí)', () => {
    expect(predictiveHighlights(lib, DEFAULT_DYNAMIC, [yo, comer]).autoOpen).toBe('f-comida')
  })

  it('si encaja con varias carpetas o con fichas del principal: no se abre ninguna, se resaltan', () => {
    const h = predictiveHighlights(lib, DEFAULT_DYNAMIC, [yo, jugar])
    expect(h.autoOpen).toBeNull()
    const folderCell = (t: string) => lib.boards.root.cells.find((c) => c.target === t)!.id
    expect(h.lit.has(folderCell('f-juguetes')) && h.lit.has(folderCell('f-deportes'))).toBe(true)
    expect(h.lit.has(folderCell('f-comida'))).toBe(false)
    expect(predictiveHighlights(lib, DEFAULT_DYNAMIC, [yo, querer]).autoOpen).toBeNull() // también verbos
  })
})
