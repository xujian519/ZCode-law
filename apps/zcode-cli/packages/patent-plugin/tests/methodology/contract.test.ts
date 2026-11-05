import { describe, expect, it } from 'vitest'
import * as index from '../../src/methodology/index.js'
import type { PatentMethodologyContract } from '../../src/methodology/contract.js'

// 契约测试只经公开入口（index.js/contract.js）访问模块：把公开入口的真实导出绑定到
// 契约接口，编译期校验形状一致，运行期抽验行为。module.ts 清单断言留在 adopt 脚手架
// 的 src/methodology/contract.test.ts（不在根 vitest include 内，随模块走）。

const contract: PatentMethodologyContract = {
  loadMatrix: index.loadMatrix,
  lookupMatrixCell: index.lookupMatrixCell,
  loadPrinciples: index.loadPrinciples,
  principleById: index.principleById,
  loadSeparations: index.loadSeparations,
  validateTrizAssets: index.validateTrizAssets,
  paramLabel: index.paramLabel,
  principleNames: index.principleNames,
}

describe('patent-methodology contract', () => {
  it('public entry satisfies the contract and validates the shipped assets', () => {
    expect(() => contract.validateTrizAssets()).not.toThrow()
    expect(contract.lookupMatrixCell(14, 1)).toEqual([1, 8, 40, 15])
    expect(contract.paramLabel(14)).toBe('强度')
  })
})
