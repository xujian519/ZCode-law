import { describe, expect, it } from 'vitest'
import {
  loadMatrix,
  loadPrinciples,
  loadSeparations,
  lookupMatrixCell,
  paramLabel,
  principleNames,
  TRIZ_PROMPT_TEXT,
} from '../../src/methodology/index.js'

// 源：DSH methodology/tests/methodology.spec.ts 的「TRIZ data access」describe
// 与 prompt 文案 snapshot 用例（纯数据访问部分，不依赖 Cordis 宿主）。

describe('TRIZ data access', () => {
  it('lookupMatrixCell returns [] for out-of-range parameters', () => {
    expect(lookupMatrixCell(14, 0)).toEqual([])
    expect(lookupMatrixCell(0, 14)).toEqual([])
  })

  it('paramLabel falls back to the number for unknown parameters', () => {
    expect(paramLabel(99)).toBe('99')
  })

  it('principleNames renders unknown ids without a name', () => {
    expect(principleNames([999])).toBe('999')
    expect(principleNames([1, 999])).toBe('1 分割, 999')
  })

  it('lookupMatrixCell resolves classic reference cells', () => {
    expect(lookupMatrixCell(14, 1)).toEqual([1, 8, 40, 15])
    expect(lookupMatrixCell(9, 10)).toEqual([13, 28, 15, 19])
    expect(lookupMatrixCell(3, 15)).toEqual([19])
    expect(lookupMatrixCell(6, 14)).toEqual([40])
    expect(lookupMatrixCell(14, 20)).toEqual([35])
  })

  it('matrix data is 39x39 with 1248 filled cells of principle numbers 1-40', () => {
    const data = loadMatrix()
    expect(data.length).toBe(39)
    let filled = 0
    let diagonalEmpty = 0
    let offDiagonalEmpty = 0
    for (let worsening = 0; worsening < data.length; worsening += 1) {
      const row = data[worsening] as number[][]
      expect(row.length).toBe(39)
      for (let improving = 0; improving < row.length; improving += 1) {
        const cell = row[improving] as number[]
        if (cell.length > 0) filled += 1
        else if (improving === worsening) diagonalEmpty += 1
        else offDiagonalEmpty += 1
        for (const n of cell) {
          expect(n).toBeGreaterThanOrEqual(1)
          expect(n).toBeLessThanOrEqual(40)
        }
      }
    }
    expect(filled).toBe(1248)
    expect(diagonalEmpty).toBe(39)
    expect(offDiagonalEmpty).toBe(234)
  })

  it('records the single duplicated source cell and deduplicates it on read', () => {
    const duplicated = loadMatrix().flat().filter(cell => new Set(cell).size !== cell.length)
    // Casey Perno xls and pytriz both transcribe (improving 19, worsening 9) as
    // [8, 35, 35]; keep the source value, never guess a replacement.
    expect(duplicated).toEqual([[8, 35, 35]])
    expect(lookupMatrixCell(19, 9)).toEqual([8, 35])
  })

  it('matrix diagonal cells are empty physical contradictions', () => {
    const data = loadMatrix()
    for (let i = 0; i < 39; i += 1) {
      expect(data[i]?.[i]).toEqual([])
    }
  })

  it('principles data holds 40 numbered, named, described entries', () => {
    const data = loadPrinciples()
    expect(data.length).toBe(40)
    expect(new Set(data.map(p => p.no)).size).toBe(40)
    expect(data.map(p => p.no)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1))
    for (const p of data) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(0)
    }
  })

  it('separation data holds five uniquely identified, actionable entries', () => {
    const data = loadSeparations()
    expect(data.length).toBe(5)
    expect(new Set(data.map(separation => separation.id)).size).toBe(5)
    for (const separation of data) {
      expect(separation.name.length).toBeGreaterThan(0)
      expect(separation.description.length).toBeGreaterThan(0)
      expect(separation.signals.length).toBeGreaterThan(0)
    }
  })
})

describe('tool:triz system-prompt text', () => {
  it('pins the tool:triz system-prompt text', () => {
    expect(TRIZ_PROMPT_TEXT).toMatchInlineSnapshot(`
      "For patent innovation, design-around, and trade-off analysis, use the triz tool when a task names a technical contradiction or conflict between two engineering parameters.
      Call triz with no arguments to list the 39 classic engineering parameters and the 40 inventive principles.
      Call triz with an improving and a worsening parameter number (1-39) to read that contradiction-matrix cell and its recommended inventive principles.
      triz only reads a matrix cell for two explicit parameter numbers; identifying parameters or contradictions from a disclosure is outside its scope."
    `)
  })
})
