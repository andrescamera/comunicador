import { FOLDER_NEXT, inlineFolder, pathToBoard, type Area } from './layout'
import type { Board, Cell, Library } from './types'

/** Sin tildes ni mayúsculas: «Camión» se encuentra escribiendo «camion» */
export const foldText = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

export interface CellHit {
  cell: Cell
  board: Board
  /** Carpetas que hay que abrir desde el principal para llegar a su tablero ([] = el principal) */
  path: string[]
  /** Nombres de los tableros por los que se pasa (sin el principal): «Comida › Frutas» */
  trail: string[]
}

/**
 * Fichas visibles de todos los tableros cuya etiqueta contiene el texto (sin tildes ni mayúsculas).
 * Primero las que empiezan por él, luego las que lo tienen al principio de una palabra y después el resto;
 * a igualdad, las que están más cerca del principal.
 */
export function searchCells(lib: Library, query: string, limit = 40): CellHit[] {
  const q = foldText(query)
  if (!q) return []
  const hits: (CellHit & { rank: number })[] = []
  for (const board of Object.values(lib.boards)) {
    const path = pathToBoard(lib, board.id)
    if (!path) continue // tablero suelto, al que no se llega desde el principal
    const trail = path.map((id) => lib.boards[id]?.name ?? '')
    for (const cell of board.cells) {
      if (cell.hidden) continue // en uso no se ven
      const label = foldText(cell.label)
      const i = label.indexOf(q)
      if (i < 0) continue
      const rank = i === 0 ? 0 : /[\s'’-]/.test(label[i - 1]) ? 1 : 2
      hits.push({ cell, board, path, trail, rank })
    }
  }
  return hits
    .sort((a, b) => a.rank - b.rank || a.path.length - b.path.length || a.cell.label.localeCompare(b.cell.label, 'es'))
    .slice(0, limit)
    .map(({ rank: _, ...h }) => h)
}

/** Carpeta que se ve en la zona del principal: en qué página sale una de sus fichas */
export function pageOfCell(root: Board, folder: Board, area: Area, cellId: string): number {
  for (let page = 0; page < 50; page++) {
    const { board, pages } = inlineFolder(root, folder, area, page)
    if (board.cells.some((c) => c.id === cellId)) return page
    if (page >= pages - 1 || !board.cells.some((c) => c.id === FOLDER_NEXT)) break
  }
  return 0
}
