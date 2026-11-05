/**
 * The model-facing writing-pattern section: the stable instruction prose plus
 * the compiled `<writing_skills>` block of the patterns this deployment injects.
 * @module @deepseek-ai/dsh-writing-patterns/prompt
 */

import type { PatternStore } from './pattern-store.js'
import type { PatternCategory, WritingPattern } from './types.js'

/** Name of the system-prompt section this package contributes. */
export const WRITING_PATTERNS_SECTION_NAME = 'writing-patterns:skills'

/**
 * Stable system-prompt prose: what the injected block is, and when the model
 * should reach for the tool instead of reading it.
 */
export const WRITING_PATTERNS_PROMPT_TEXT = [
  'The <writing_skills> block below lists the writing patterns of this deployment for patent drafting and office-action replies; each pattern names one drafting situation with its ordered steps and the rules to follow or avoid.',
  'When the case at hand is not covered by those patterns, call query_writing_patterns with the case category, the case features, or search keywords to retrieve the patterns that match it.',
].join('\n\n')

/**
 * The section text: the instruction prose, then the compiled patterns when the
 * deployment injects any.
 *
 * The compiled block is fenced so the section reads as instruction prose plus
 * one quoted data block: a bare multi-line XML run would parse as a prose
 * paragraph of the prompt itself, which both obscures where the data starts and
 * violates the one-physical-line-per-paragraph convention for prompt text. The
 * fence is longer than any backtick run in the block, so authored text cannot
 * close it early.
 * @param skills - the compiled `<writing_skills>` block, or `''` for none.
 * @returns the section text.
 */
export function renderWritingSkillsSection(skills: string): string {
  if (skills === '') return WRITING_PATTERNS_PROMPT_TEXT
  const fence = fenceFor(skills)
  return `${WRITING_PATTERNS_PROMPT_TEXT}\n\n${fence}xml\n${skills}\n${fence}`
}

/**
 * Patterns the section injects: the requested categories in the given order,
 * each in id order, with a pattern tagged by two requested categories listed once.
 *
 * 来源：DSH 源包 src/index.ts 的 apply() 私有辅助 sectionPatterns。它是纯选择逻辑
 * （无 Cordis 依赖），随 prompt 组迁移保留，P7 的插件组装层重建 system-prompt
 * section 时直接复用，避免重新推导注入顺序与去重规则。
 * @param store - the loaded corpus.
 * @param categories - the categories to inject.
 * @returns the patterns in injection order.
 */
export function sectionPatterns(store: PatternStore, categories: readonly PatternCategory[]): readonly WritingPattern[] {
  const seen = new Set<string>()
  const patterns: WritingPattern[] = []
  for (const category of categories) {
    for (const pattern of store.byCategory(category)) {
      if (seen.has(pattern.id)) continue
      seen.add(pattern.id)
      patterns.push(pattern)
    }
  }
  return patterns
}

/** A backtick fence longer than any backtick run in `text`. */
function fenceFor(text: string): string {
  let longest = 0
  for (const run of text.matchAll(/`+/gu)) longest = Math.max(longest, run[0].length)
  return '`'.repeat(Math.max(3, longest + 1))
}
