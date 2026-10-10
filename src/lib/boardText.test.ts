import { describe, expect, it } from 'vitest'
import { boardToText, parseBoardText, planBoardText } from './boardText'
import { layoutCells } from './layout'
import type { Board, Cell, Library } from './types'

const w = (id: string, label: string, row: number, col: number, extra: Partial<Cell> = {}): Cell => ({
  id,
  kind: 'word',
  label,
  category: 'noun',
  row,
  col,
  ...extra,
})
const folder = (id: string, label: string, row: number, col: number, target: string): Cell => ({ id, kind: 'folder', label, category: 'misc', row, col, target, picto: 1 })
const zones = layoutCells([], { rows: 4, cols: 6 }).zones

/** 4 × 6 · Pronombre (columna 1) con la carpeta «más» (y dentro «otros») · Carpetas (filas 1-2, columnas 2-3) · Social (filas 2-3, columnas 4-5) · «ayuda» suelta */
function sample(): Library {
  const base = { rows: 4, cols: 6, zones }
  const root: Board = {
    ...base,
    id: 'root',
    name: 'Inicio',
    groups: [
      { id: 'g1', name: 'Pronombre', area: { r0: 0, r1: 3, c0: 0, c1: 0 }, color: 'pronoun' },
      { id: 'g2', name: 'Carpetas', area: { r0: 0, r1: 1, c0: 1, c1: 2 }, folders: true },
      { id: 'g3', name: 'Social', area: { r0: 1, r1: 2, c0: 3, c1: 4 }, color: 'social' },
    ],
    cells: [
      w('yo', 'yo', 0, 0, { category: 'pronoun' }),
      w('tu', 'tú', 1, 0, { category: 'pronoun' }),
      folder('mas', 'más', 2, 0, 'b-mas'),
      folder('comida', 'Comida', 0, 1, 'b-comida'),
      w('hola', 'hola', 1, 3, { category: 'social' }),
      w('adios', 'adiós', 2, 3, { category: 'social' }),
      w('gracias', 'gracias', 2, 4, { category: 'social' }),
      w('ayuda', 'ayuda', 3, 5, { category: 'misc' }),
    ],
  }
  const mas: Board = {
    ...base,
    id: 'b-mas',
    name: 'más',
    cells: [w('vos', 'vosotros', 0, 0, { category: 'pronoun' }), w('ellos', 'ellos', 1, 0, { category: 'pronoun' }), folder('otros', 'otros', 2, 0, 'b-otros')],
  }
  const otros: Board = { ...base, id: 'b-otros', name: 'otros', cells: [w('eles', 'eles', 0, 0)] }
  const comida: Board = { ...base, id: 'b-comida', name: 'Comida', inZone: true, cells: [w('agua', 'agua', 0, 1), w('leche', 'leche', 1, 1)] }
  return { rootId: 'root', boards: { root, 'b-mas': mas, 'b-otros': otros, 'b-comida': comida } }
}

const plan = (lib: Library, text: string) => {
  const { doc, errors } = parseBoardText(text)
  expect(errors).toEqual([])
  return planBoardText(lib, doc!)
}
const pos = (lib: Library, board: string, label: string) => {
  const c = lib.boards[board].cells.find((x) => x.label === label)
  return c && [c.row, c.col]
}

describe('tablero escrito: exportar', () => {
  it('escribe grupos, carpetas anidadas con tabuladores, huecos y sueltas con posición', () => {
    const text = boardToText(sample())
    expect(text).toContain('# Inicio [4 filas, 6 columnas]\nayuda [categoría: otros, fila 4, columna 6]\n')
    expect(text).toContain('@ Pronombre [filas 1-4, columna 1, color: pronombre]\nyo\ntú\nmás\n\tvosotros')
    expect(text).toContain('\totros\n\t\teles')
    expect(text).toContain('@ Social [filas 2-3, columnas 4-5, color: social]\nhola\nadiós\n_\ngracias')
    expect(text).toContain('@ Carpetas [filas 1-2, columnas 2-3, carpetas]\nComida\n\tagua\n\tleche')
  })

  it('ida y vuelta: el mismo tablero, sin cambios', () => {
    const lib = sample()
    const p = plan(lib, boardToText(lib))
    expect(p.errors).toEqual([])
    expect(p.changes).toEqual([])
    expect(p.jobs).toEqual([])
    for (const id of Object.keys(lib.boards))
      expect(p.lib!.boards[id].cells.map((c) => [c.id, c.row, c.col]).sort()).toEqual(lib.boards[id].cells.map((c) => [c.id, c.row, c.col]).sort())
    // y volver a escribirlo da el mismo texto
    expect(boardToText(p.lib!)).toBe(boardToText(lib))
  })

  it('un tablero sin grupos guardados: los de las columnas, y vuelve igual', () => {
    const root: Board = { id: 'r', name: 'Inicio', ...layoutCells([{ id: 'a', kind: 'word', label: 'yo', category: 'pronoun' }, { id: 'b', kind: 'word', label: 'comer', category: 'verb' }], { rows: 3, cols: 5 }) }
    const lib: Library = { rootId: 'r', boards: { r: root } }
    const p = plan(lib, boardToText(lib))
    expect(p.changes).toEqual([])
    expect(p.lib!.boards.r.groups!.length).toBeGreaterThan(0)
  })
})

describe('tablero escrito: cambios', () => {
  it('añadir: va a la siguiente casilla de su grupo o de la carpeta', () => {
    const lib = sample()
    const text = boardToText(lib).replace('\tleche\n', '\tleche\n\tpan\n').replace('\t\teles\n', '\t\teles\nél\n')
    const p = plan(lib, text)
    expect(p.errors).toEqual([])
    expect(pos(p.lib!, 'b-comida', 'pan')).toEqual([0, 2]) // la zona de carpetas, por columnas
    expect(pos(p.lib!, 'root', 'él')).toEqual([3, 0])
    expect(p.changes.find((c) => c.path === 'Inicio')!.added).toEqual(['él'])
    expect(p.jobs.map((j) => j.query).sort()).toEqual(['pan', 'él'])
  })

  it('quitar una carpeta: avisa de lo que se va con ella y borra sus tableros', () => {
    const lib = sample()
    const text = boardToText(lib).replace(/más\n(\t.*\n)+/, '')
    const p = plan(lib, text)
    expect(p.changes[0].removed).toEqual(['más'])
    expect(p.changes[0].removedFolders).toEqual([{ label: 'más', cells: 3, folders: 1 }])
    expect(p.lib!.boards['b-mas']).toBeUndefined()
    expect(p.lib!.boards['b-otros']).toBeUndefined()
  })

  it('una carpeta nueva con subcarpeta y un grupo nuevo', () => {
    const lib = sample()
    const text = boardToText(lib).replace('Comida\n', 'Animales [color: nombre]\n\tGranja\n\t\tvaca\nComida\n') + '\n@ Verbos [filas 1-4, columna 6, color: verbo]\ncomer\n'
    const p = plan(lib, text.replace('ayuda [categoría: otros, fila 4, columna 6]', 'ayuda [categoría: otros, fila 4, columna 5]'))
    expect(p.errors).toEqual([])
    const root = p.lib!.boards.root
    const animales = root.cells.find((c) => c.label === 'Animales')!
    expect([animales.row, animales.col, animales.folderColor]).toEqual([0, 1, 'noun'])
    expect(pos(p.lib!, 'root', 'Comida')).toEqual([1, 1]) // se desplaza: va después en el grupo
    const granja = p.lib!.boards[animales.target!].cells[0]
    expect(p.lib!.boards[granja.target!].cells.map((c) => c.label)).toEqual(['vaca'])
    expect(p.lib!.boards[animales.target!].inZone).toBe(true)
    expect(root.groups!.map((g) => g.name)).toContain('Verbos')
    expect(pos(p.lib!, 'root', 'comer')).toEqual([0, 5])
    expect(p.changes[0].moved).toBe(2) // Comida y ayuda
  })

  it('opciones: solo texto, oculta, categoría y picto', () => {
    const lib = sample()
    const p = plan(lib, boardToText(lib).replace('hola\n', 'hola [solo texto, oculta, categoría: pregunta, picto: 1234]\n'))
    const hola = p.lib!.boards.root.cells.find((c) => c.label === 'hola')!
    expect(hola).toMatchObject({ textOnly: true, hidden: true, category: 'question' })
    expect(p.jobs).toEqual([expect.objectContaining({ cellId: 'hola', query: '1234', exact: true })])
    expect(p.changes[0].changed).toEqual(['hola'])
  })

  it('un grupo que ya existe se puede escribir sin rectángulo', () => {
    const lib = sample()
    const p = plan(lib, boardToText(lib).replace('@ Pronombre [filas 1-4, columna 1, color: pronombre]', '@ Pronombre'))
    expect(p.errors).toEqual([])
    expect(p.changes).toEqual([])
  })

  it('también con espacios en vez de tabuladores', () => {
    const lib = sample()
    const p = plan(lib, boardToText(lib).replace(/\t/g, '        '))
    expect(p.changes).toEqual([])
  })
})

describe('tablero escrito: errores con su línea', () => {
  const errorsOf = (text: string, lib = sample()) => {
    const { doc, errors } = parseBoardText(text)
    if (errors.length || !doc) return errors
    return planBoardText(lib, doc).errors
  }

  it('de forma', () => {
    expect(errorsOf('yo')).toEqual([{ line: 1, message: expect.stringContaining('empezar por el tablero principal') }])
    expect(errorsOf('# Inicio\nyo [pictograma: x]')[0]).toEqual({ line: 2, message: expect.stringContaining('¿Querías decir «picto»?') })
    expect(errorsOf('# Inicio\n@ A [filas 1-2, columna 1]\n\tmal')[0]).toEqual({ line: 3, message: expect.stringContaining('carpeta') })
    expect(errorsOf('# Inicio\nmás\n\t\tuno\n\tdos')[0]).toEqual({ line: 4, message: expect.stringContaining('no coincide') })
    expect(errorsOf('# Inicio\nmás\n\tuno\notro\n    dos')[0]).toEqual({ line: 5, message: expect.stringContaining('mezcla tabuladores y espacios') })
    expect(errorsOf('# Inicio\nyo [fila 2]')[0].message).toContain('fila y columna')
    expect(errorsOf('# Inicio\nyo [categoría: cosa]')[0].message).toContain('categoría «cosa» desconocida')
    expect(errorsOf('# Inicio\n@ A [filas 1-2, columnas 1-1]\n@ A [filas 3-4, columnas 1-1]')[0]).toEqual({ line: 3, message: expect.stringContaining('ya está definido') })
  })

  it('del tablero', () => {
    const lib = sample()
    const text = boardToText(lib)
    expect(errorsOf(text.replace('@ Social [filas 2-3, columnas 4-5', '@ Social [filas 2-3, columnas 1-2'))[0].message).toContain('se solapa con «Pronombre»')
    expect(errorsOf(text.replace('gracias\n', 'gracias\ngenial\n'))[0].message).toContain('«Social» tiene 4 casillas y hay 5')
    expect(errorsOf(text + '@ Nuevo\nhey\n')[0].message).toContain('es nuevo: escribe dónde va')
    expect(errorsOf(text.replace('columna 6]', 'columna 9]'))[0].message).toContain('fuera del tablero')
    expect(errorsOf(text.replace('fila 4, columna 6]', 'fila 2, columna 4]'))[0].message).toContain('es del grupo «Social»')
    expect(errorsOf(text.replace('\tleche\n', '\tleche\n\tpan\n\tsal\n\tuva\n'))).toEqual([]) // no caben en la zona: a pantalla completa
    expect(errorsOf(text.replace('# Inicio [4 filas, 6 columnas]', '# Inicio [4 filas, 9 columnas]').replace('@ Social [filas 2-3, columnas 4-5', '@ Social [filas 2-3, columnas 4-12'))[0].message).toContain('se sale del tablero')
  })
})
