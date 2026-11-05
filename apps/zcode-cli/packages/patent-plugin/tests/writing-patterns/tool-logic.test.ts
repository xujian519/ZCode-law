import { describe, expect, it } from 'vitest'
import { loadPatternStore } from '../../src/writing-patterns/pattern-store.js'
import {
  buildQueryWritingPatternsOutput,
  renderQueryWritingPatterns,
  resolveQueryLimit,
  selectQueryMode,
  selectQueryPatterns,
} from '../../src/writing-patterns/tool-logic.js'
import type { QueryWritingPatternsOutput } from '../../src/writing-patterns/tool-types.js'

// 源：DSH writing-patterns/tests/tool.spec.ts。原测试经 Cordis 宿主 + dsh-tools 注册表
// 执行 query_writing_patterns；剥掉工具组合层后，schema 注册表声明类用例跳过不迁，
// 执行行为断言改写为对 tool-logic 纯函数（buildQueryWritingPatternsOutput 等）的直接
// 调用，期望值逐字保留。

const MATCH_LIMIT = 5

function run(args: Parameters<typeof buildQueryWritingPatternsOutput>[1]): QueryWritingPatternsOutput {
  return buildQueryWritingPatternsOutput(loadPatternStore(), args, MATCH_LIMIT)
}

describe('query_writing_patterns output.render', () => {
  const value: QueryWritingPatternsOutput = {
    mode: 'category',
    patterns: [{
      id: 'wp-oa-inventiveness-3step',
      name: '创造性三步法 OA 答复框架',
      category: 'oa_inventiveness',
    }],
    librarySize: 10,
    skills: '<writing_skills>\n</writing_skills>',
  }

  it('renders the selected patterns and the compiled block', () => {
    expect(renderQueryWritingPatterns({ category: 'oa_inventiveness' }, value)).toBe([
      '写作模式库：命中 1 / 10 个模式（按类目列举）。',
      '',
      '匹配到的模式：',
      '- `wp-oa-inventiveness-3step` · OA 答复-创造性 · **创造性三步法 OA 答复框架**',
      '',
      '编译后的写作技能：',
      '<writing_skills>',
      '</writing_skills>',
    ].join('\n'))
  })

  it('renders the no-match guidance without a skills block', () => {
    const rendered = renderQueryWritingPatterns({ query: 'zzzz' }, { ...value, mode: 'search', patterns: [], skills: '' })
    expect(rendered).toBe('写作模式库：没有匹配的模式（库中共 10 个）。改用其他关键词或类目，或省略全部参数以列举库中的模式。')
  })
})

describe('query_writing_patterns selection（mode / limit / patterns 纯函数行为）', () => {
  it('selects the mode from the arguments', () => {
    const store = loadPatternStore()
    expect(selectQueryMode({})).toBe('catalog')
    expect(selectQueryMode({ category: 'oa_novelty' })).toBe('category')
    expect(selectQueryMode({ features: ['创造性'] })).toBe('match')
    expect(selectQueryMode({ query: '三步法' })).toBe('search')
    expect(selectQueryMode({ query: '   ', features: [''] })).toBe('catalog')
    expect(selectQueryMode({ query: '三步法', features: ['创造性'] })).toBe('search')
    expect(selectQueryPatterns(store, 'catalog', {}, 5)).toHaveLength(5)
  })

  it('resolves the result cap and rejects a non-positive limit', () => {
    expect(resolveQueryLimit(undefined, 5)).toBe(5)
    expect(resolveQueryLimit(3, 5)).toBe(3)
    expect(() => resolveQueryLimit(0, 5)).toThrow(/limit must be a positive integer/)
  })

  it('lists the whole library when nothing narrows it', () => {
    const value = run({})
    expect(value.mode).toBe('catalog')
    expect(value.librarySize).toBeGreaterThan(MATCH_LIMIT)
    expect(value.patterns).toHaveLength(value.librarySize)
    expect(value.skills).toContain('<skill id="wp-claim-dependent-layering">')
    expect(renderQueryWritingPatterns({}, value)).toContain(
      `写作模式库：命中 ${String(value.librarySize)} / ${String(value.librarySize)} 个模式（列举模式库）。`,
    )
  })

  it('lists one category in id order', () => {
    const value = run({ category: 'claim_drafting' })
    expect(value.mode).toBe('category')
    expect(value.patterns.map(pattern => pattern.id)).toEqual(['wp-claim-dependent-layering', 'wp-claim-utility-model'])
    expect(value.skills).toContain('<skill id="wp-claim-utility-model">')
    expect(value.skills).not.toContain('wp-spec-background')
  })

  it('searches within a category when both a query and a category are given', () => {
    const value = run({ query: '新颖性', category: 'oa_novelty' })
    expect(value.mode).toBe('search')
    expect(value.patterns.map(pattern => pattern.id)).toEqual(['wp-oa-novelty-separate'])
  })

  it('matches features within a category and ignores blank features', () => {
    const value = run({ category: 'claim_drafting', features: ['引用关系', '   '] })
    expect(value.mode).toBe('match')
    expect(value.patterns.map(pattern => pattern.id)).toContain('wp-claim-dependent-layering')
  })

  it('matches case features without a category', () => {
    const value = run({ features: ['创造性'] })
    expect(value.mode).toBe('match')
    expect(value.patterns.map(pattern => pattern.id)).toContain('wp-oa-inventiveness-3step')
  })

  it('caps an argument-free catalog listing with an explicit limit', () => {
    const value = run({ limit: 2 })
    expect(value.mode).toBe('catalog')
    expect(value.patterns).toHaveLength(2)
    expect(value.librarySize).toBeGreaterThan(2)
  })

  it('searches by keyword and honours a per-call limit', () => {
    const value = run({ query: '三步法', limit: 1 })
    expect(value.mode).toBe('search')
    expect(value.patterns.map(pattern => pattern.id)).toEqual(['wp-oa-inventiveness-3step'])
    expect(Object.keys(value.patterns[0] ?? {}).sort()).toEqual(['category', 'id', 'name'])
    expect(renderQueryWritingPatterns({ query: '三步法' }, value)).toContain('（按关键词检索）')
  })

  it('finds patterns from a natural-language Chinese query', () => {
    const value = run({ query: '创造性答复怎么写' })
    expect(value.mode).toBe('search')
    expect(value.patterns[0]?.id).toBe('wp-oa-inventiveness-3step')
  })

  it('matches case features and keeps the category as the case type', () => {
    const value = run({ category: 'oa_clarity', features: ['功能性限定'] })
    expect(value.mode).toBe('match')
    expect(value.patterns.map(pattern => pattern.id)).toEqual(['wp-oa-clarity-support'])
    expect(value.skills).toContain('<step order="3">')
  })

  it('returns an empty result when nothing matches', () => {
    const value = run({ query: 'zzzz' })
    expect(value.mode).toBe('search')
    expect(value.patterns).toEqual([])
    expect(value.skills).toBe('')
    expect(value.librarySize).toBeGreaterThan(0)
    expect(renderQueryWritingPatterns({ query: 'zzzz' }, value)).toContain('没有匹配的模式')
  })

  it('fails loud on a limit that is not positive', () => {
    expect(() => run({ limit: 0 })).toThrow(/limit must be a positive integer/)
  })
})
