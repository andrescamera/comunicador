import type { Category, CellKind } from './types'

// Clave de colores de Fitzgerald (modificada), la habitual en SAAC en España
export const CATEGORY_COLORS: Record<Category, { bg: string; border: string }> = {
  pronoun: { bg: '#fff4b8', border: '#e0b800' },
  person: { bg: '#fff4b8', border: '#e0b800' },
  verb: { bg: '#d3f2c9', border: '#4caf50' },
  noun: { bg: '#ffe0bd', border: '#f08c00' },
  adjective: { bg: '#d6e8ff', border: '#3d7fd9' },
  social: { bg: '#ffd9e8', border: '#e0578f' },
  question: { bg: '#e8dbfa', border: '#8a5cd1' },
  negation: { bg: '#ffd2cc', border: '#e0402f' },
  misc: { bg: '#ffffff', border: '#9aa3ad' },
}

export function cellColors(category: Category, kind: CellKind) {
  if (kind === 'folder') return { bg: '#efe6d6', border: '#8d6e4a' }
  return CATEGORY_COLORS[category]
}
