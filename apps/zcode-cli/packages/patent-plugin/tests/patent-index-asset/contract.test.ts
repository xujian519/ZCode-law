import { describe, expect, it } from 'vitest'
import * as index from '../../src/patent-index-asset/index.js'
import type { PatentIndexAssetContract } from '../../src/patent-index-asset/contract.js'

// 契约测试只经公开入口（index.js/contract.js）访问模块：把公开入口的真实导出绑定到
// 契约接口，编译期校验形状一致，运行期抽验行为。module.ts 清单断言留在 adopt 脚手架
// 的 src/patent-index-asset/contract.test.ts（不在根 vitest include 内，随模块走）。

const contract: PatentIndexAssetContract = {
  parseYamlMapping: index.parseYamlMapping,
  readMapping: index.readMapping,
  readString: index.readString,
  readOptionalString: index.readOptionalString,
  readOptionalDate: index.readOptionalDate,
  readCount: index.readCount,
  readOptionalCount: index.readOptionalCount,
  readOptionalBoolean: index.readOptionalBoolean,
  readEnum: index.readEnum,
  readRecordedSource: index.readRecordedSource,
}

describe('patent-index-asset contract', () => {
  it('public entry satisfies the contract and reads a field or fails loud', () => {
    expect(contract.readString({ document: '收费标准' }, 'document', (message) => new index.IndexAssetError(message, null)))
      .toBe('收费标准')
    expect(() => contract.readString({}, 'document', (message) => new index.IndexAssetError(message, 'x.yaml')))
      .toThrow(/字段 document 必须是非空字符串/)
  })
})
