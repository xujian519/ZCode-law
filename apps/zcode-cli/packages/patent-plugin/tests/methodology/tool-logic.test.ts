import { describe, expect, it } from 'vitest'
import { buildTrizOutput, loadMatrix, renderTriz } from '../../src/methodology/index.js'

// 源：DSH methodology/tests/methodology.spec.ts 的「plugin-registered triz tool」
// describe。原用例经 Cordis 宿主 + dsh-tools 注册表执行工具；剥掉工具组合层后，
// 同一行为断言改写为对 tool-logic 纯函数 buildTrizOutput/renderTriz 的直接调用，
// 期望值逐字保留。schema 注册表快照与 HMR 卸载用例依赖 dsh-tools/Cordis，跳过不迁。

/**
 * One empty cell off the diagonal, scanned from the shipped matrix: the
 * matrix has 234 of them, so pinning one cell number would only add a
 * fixture that breaks when the asset changes.
 * @returns the improving/worsening parameter numbers of that cell.
 */
function emptyOffDiagonalCell(): { improving: number; worsening: number } {
  const matrix = loadMatrix()
  for (let worsening = 1; worsening <= matrix.length; worsening += 1) {
    const row = matrix[worsening - 1] ?? []
    for (let improving = 1; improving <= row.length; improving += 1) {
      if (improving !== worsening && (row[improving - 1] ?? []).length === 0) {
        return { improving, worsening }
      }
    }
  }
  throw new Error('the shipped matrix has no empty off-diagonal cell')
}

describe('triz tool logic（无 Cordis 宿主的纯函数行为）', () => {
  it('lists the 39 parameters and 40 principles with no arguments', () => {
    const value = buildTrizOutput({})
    expect(value.mode).toBe('catalog')
    if (value.mode !== 'catalog') throw new Error('expected catalog')
    expect(value.parameters.length).toBe(39)
    expect(value.principles.length).toBe(40)
    expect(value.principles.map(p => p.number)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1))
    const rendered = renderTriz(value)
    expect(rendered).toContain('39 engineering parameters')
    expect(rendered).toContain('40 inventive principles')
  })

  it('looks up a contradiction-matrix cell for an improving/worsening pair', () => {
    const value = buildTrizOutput({ improving: 14, worsening: 1 })
    expect(value.mode).toBe('lookup')
    if (value.mode !== 'lookup') throw new Error('expected lookup')
    expect(value.improving).toEqual({ number: 14, label: '强度' })
    expect(value.worsening).toEqual({ number: 1, label: '运动物体重量' })
    expect(value.recommended.map(p => p.number)).toEqual([1, 8, 40, 15])
    expect(value.recommended.every(p => p.name.length > 0)).toBe(true)
    expect(value.separations).toEqual([])
    const rendered = renderTriz(value)
    expect(rendered).toContain('强度 (14)')
    expect(rendered).toContain('运动物体重量 (1)')
    expect(rendered).toContain('1, 8, 40, 15')
  })

  it('fails loudly when exactly one of improving/worsening is given', () => {
    expect(() => buildTrizOutput({ improving: 14 })).toThrow(/both improving and worsening/)
    expect(() => buildTrizOutput({ worsening: 1 })).toThrow(/both improving and worsening/)
  })

  it('returns separation principles for a diagonal physical contradiction', () => {
    const value = buildTrizOutput({ improving: 5, worsening: 5 })
    if (value.mode !== 'lookup') throw new Error('expected lookup')
    expect(value.recommended).toEqual([])
    expect(value.separations).toHaveLength(5)
    expect(value.separations.map(separation => separation.name)).toEqual([
      'Separation in space',
      'Separation in time',
      'Separation by condition',
      'Separation in direction',
      'Separation between system and subsystem',
    ])
    expect(value.separations.every(separation => separation.description.length > 0 && separation.signals.length > 0)).toBe(true)
    const rendered = renderTriz(value)
    expect(rendered).toContain('Recommended principles: none.')
    expect(rendered).toContain('physical contradiction')
    expect(rendered).toContain('Separation in space')
    expect(rendered).toContain('Separation between system and subsystem')
  })

  it('reads an empty off-diagonal cell as a matrix gap, not a physical contradiction', () => {
    const cell = emptyOffDiagonalCell()
    const value = buildTrizOutput(cell)
    if (value.mode !== 'lookup') throw new Error('expected lookup')
    expect(value.recommended).toEqual([])
    expect(value.separations).toEqual([])
    const rendered = renderTriz(value)
    expect(rendered).toContain('Recommended principles: none.')
    expect(rendered).not.toContain('physical contradiction')
    expect(rendered).not.toContain('Separation principles:')
  })

  it('rejects an improving parameter outside 1-39', () => {
    expect(() => buildTrizOutput({ improving: 40, worsening: 1 })).toThrow(/improving must be an integer 1-39/)
  })

  it('rejects a worsening parameter outside 1-39', () => {
    expect(() => buildTrizOutput({ improving: 14, worsening: 0 })).toThrow(/worsening must be an integer 1-39/)
  })

  it('render throws for an unknown mode (exhaustive default)', () => {
    expect(() => renderTriz({ mode: 'bogus' } as never)).toThrow(/未知 TrizOutput mode/)
  })
})
