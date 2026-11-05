// 源：DSH methodology/tests/assets-missing.spec.ts 的第一个用例。
// 第二个用例（host.plugin 拒绝加载）依赖 Cordis 宿主，按移植规则跳过、不迁。
// 缺失矩阵资产必须在启动时失败，而不是在模型首次调用 triz 时才失败：在持久资产
// 边界 mock 文件读取，直接验证 validateTrizAssets 抛出缺失信息。
import { describe, expect, it, vi } from 'vitest'
import { validateTrizAssets } from '../../src/methodology/index.js'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    readFileSync(path: Parameters<typeof actual.readFileSync>[0]) {
      if (String(path).endsWith('triz-matrix.json')) throw new Error('ENOENT: triz-matrix.json')
      return actual.readFileSync(path, 'utf8')
    },
  }
})

describe('missing TRIZ asset at plugin start', () => {
  it('validateTrizAssets surfaces the missing file', () => {
    expect(() => { validateTrizAssets() }).toThrow(/ENOENT: triz-matrix.json/)
  })
})
