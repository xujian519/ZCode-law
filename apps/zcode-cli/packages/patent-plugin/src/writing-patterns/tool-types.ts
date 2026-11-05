/**
 * query_writing_patterns 工具的输入/输出类型（专利域移植）。
 *
 * 来源：DSH `@deepseek-ai/dsh-writing-patterns` 的 `src/tool/query-writing-patterns.ts`。
 * 该文件本是 defineTool 包装器（属 Cordis/dsh-tools 组合层，本期不迁，P3 由
 * patent-tools 重建）；此处只保留其中与运行时无关的输入/输出类型，供 P3 的
 * patent-tools 与测试使用。类型本身与源文件逐字一致，无语义改动。
 */

import type { PatternStore } from './pattern-store.js'
import type { PatternCategory } from './types.js'

/** Tool input. */
export type QueryWritingPatternsInput = {
  category?: PatternCategory
  /** Search keywords; when set, the call searches by keyword instead of matching case features. */
  query?: string
  /** Technical features or keywords of the case. */
  features?: string[]
  /**
   * Maximum number of patterns to return; a search, feature-match, or category call without a limit
   * is capped by `matchLimit`, while an argument-free call lists the whole library.
   */
  limit?: number
}

/** One selected pattern as the model sees it: the index entry above the compiled block. */
export type WritingPatternView = {
  id: string
  name: string
  category: PatternCategory
}

/** How the returned patterns were selected. */
export type QueryWritingPatternsMode = 'search' | 'match' | 'category' | 'catalog'

/** The tool's canonical result: the selected patterns and their compiled block. */
export type QueryWritingPatternsOutput = {
  mode: QueryWritingPatternsMode
  patterns: WritingPatternView[]
  /** Patterns in the loaded corpus, so a narrow hit is distinguishable from a small library. */
  librarySize: number
  /** Compiled block for `patterns`; `''` when nothing matched. */
  skills: string
}

/** Injected collaborators. */
export type QueryWritingPatternsToolOptions = {
  store: PatternStore
  /** Cap applied when a search, feature-match, or category call omits `limit`; an argument-free listing returns the whole library. */
  matchLimit: number
}
