import { describe, expect, it } from 'vitest'

describe('charla rápida', async () => {
  const { QUICK_CHAT_TEXT, parseText } = await import('./generator')
  it('frases enteras, en cuatro grupos de columnas, cada una en su sitio', () => {
    const [b] = parseText(QUICK_CHAT_TEXT, { grid: true })
    expect(b.items.length).toBe(33)
    expect(b.items.every((i) => i.kind === 'phrase')).toBe(true)
    expect(b.items.find((i) => i.label === '¿quieres jugar conmigo?')).toMatchObject({ row: 2, col: 3 })
    expect(b.items.find((i) => i.label === 'tengo hambre')).toMatchObject({ row: 1, col: 7 })
    expect(b.gridRows).toBe(7)
  })
})