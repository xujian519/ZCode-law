import { describe, expect, it } from 'vitest'
import { renderWritingSkillsSection, WRITING_PATTERNS_PROMPT_TEXT } from '../../src/writing-patterns/prompt.js'

// 源：DSH writing-patterns/tests/prompt.spec.ts（纯库测试，import 改写）。

describe('renderWritingSkillsSection', () => {
  it('returns the instruction prose alone without a compiled block', () => {
    expect(renderWritingSkillsSection('')).toBe(WRITING_PATTERNS_PROMPT_TEXT)
  })

  it('fences a block without backticks with three backticks', () => {
    expect(renderWritingSkillsSection('<writing_skills>\n</writing_skills>')).toBe([
      WRITING_PATTERNS_PROMPT_TEXT,
      '',
      '```xml',
      '<writing_skills>',
      '</writing_skills>',
      '```',
    ].join('\n'))
  })

  it('lengthens the fence past any backtick run in the block', () => {
    const text = renderWritingSkillsSection('<writing_skills>\n```\n</writing_skills>')
    expect(text).toContain('\n````xml\n')
    expect(text.endsWith('\n````')).toBe(true)
  })
})
