import { describe, expect, it } from 'vitest'
import * as index from '../../src/writing-patterns/index.js'
import type { PatentWritingPatternsContract } from '../../src/writing-patterns/contract.js'

// 契约测试只经公开入口（index.js/contract.js）访问模块：把公开入口的真实导出绑定到
// 契约接口，编译期校验形状一致，运行期抽验行为。module.ts 清单断言留在 adopt 脚手架
// 的 src/writing-patterns/contract.test.ts（不在根 vitest include 内，随模块走）。

const contract: PatentWritingPatternsContract = {
  loadPatternStore: index.loadPatternStore,
  loadPatternCorpus: index.loadPatternCorpus,
  parsePatternFile: index.parsePatternFile,
  compileWritingSkills: index.compileWritingSkills,
  renderWritingSkillsSection: index.renderWritingSkillsSection,
  sectionPatterns: index.sectionPatterns,
  selectQueryPatterns: index.selectQueryPatterns,
  renderQueryWritingPatterns: index.renderQueryWritingPatterns,
}

describe('patent-writing-patterns contract', () => {
  it('public entry satisfies the contract and compiles the shipped corpus', () => {
    const store = contract.loadPatternStore()
    const skills = contract.compileWritingSkills(store.all())
    expect(skills.startsWith('<writing_skills>')).toBe(true)
    expect(skills.endsWith('</writing_skills>')).toBe(true)
    expect(contract.sectionPatterns(store, ['claim_drafting'])).toHaveLength(2)
  })
})
