// 源：DSH methodology/tests/triz-tool-principle-gap.spec.ts。
// 原用例经 Cordis 宿主执行工具；同一守卫行为改写为对 tool-logic 纯函数的调用，
// 数据接缝 mock 方式不变。
// The shipped matrix only contains principle numbers 1-40 and every one of
// those resolves, so the tool's undefined-principle guard is unreachable
// through real data. Mock the data seam to prove the guard drops an unknown
// principle id instead of rendering a broken entry.
import { describe, expect, it, vi } from 'vitest'
import { buildTrizOutput, renderTriz } from '../../src/methodology/index.js'

vi.mock('../../src/methodology/data.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/methodology/data.js')>()
  return {
    ...actual,
    lookupMatrixCell: vi.fn(() => [999]),
    principleById: vi.fn(() => undefined),
  }
})

describe('triz tool with an unresolvable principle id from the data seam', () => {
  it('drops the unknown id from the recommended list', () => {
    const value = buildTrizOutput({ improving: 14, worsening: 1 })
    if (value.mode !== 'lookup') throw new Error('expected lookup')
    expect(value.improving).toEqual({ number: 14, label: '强度' })
    expect(value.worsening).toEqual({ number: 1, label: '运动物体重量' })
    expect(value.recommended).toEqual([])
    expect(renderTriz(value)).toContain('Recommended principles: none.')
  })
})
