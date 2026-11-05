/**
 * query_writing_patterns 工具的确定性逻辑与模型可见文案（专利域移植）。
 *
 * 来源：DSH `@deepseek-ai/dsh-writing-patterns` 的 `src/tool/query-writing-patterns.ts`。
 * 源文件是 defineTool 包装器，其中 handler 为「参数解析 + 调 pattern-store 纯函数 +
 * 组装输出」，不含 LLM 调用与 IO；按移植规则整段抽为纯逻辑，P3 的 patent-tools
 * 重建 `query_writing_patterns` 工具时直接复用本文件的选择/渲染逻辑，保证模型可见
 * 文本逐字一致。未迁部分：defineTool 注册壳（name/parameters/output.render/
 * isConcurrencySafe）由 P3 依本文件导出的 schema 常量重建。
 */

import type { PatternStore } from './pattern-store.js'
import { compileWritingSkills } from './skill-compiler.js'
import {
  PATTERN_CATEGORIES,
  PATTERN_CATEGORY_LABELS,
  type WritingPattern,
} from './types.js'
import type {
  QueryWritingPatternsInput,
  QueryWritingPatternsMode,
  QueryWritingPatternsOutput,
  WritingPatternView,
} from './tool-types.js'

/** 输出 schema 的模式视图常量（纯数据，原样来自源 tool 文件；P3 注册工具时引用）。 */
export const PATTERN_VIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    category: { type: 'string', required: true, enum: PATTERN_CATEGORIES },
  },
} as const

/** 类目参数描述里的「category (中文名)」清单（逐字来自源 tool 文件）。 */
export const CATEGORY_DESCRIPTION = PATTERN_CATEGORIES
  .map(category => `${category} (${PATTERN_CATEGORY_LABELS[category]})`)
  .join(', ')

/** 输出 schema 常量（纯数据，原样来自源 tool 文件；P3 注册工具时引用）。 */
export const QUERY_WRITING_PATTERNS_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: { type: 'string', required: true, enum: ['search', 'match', 'category', 'catalog'] },
    patterns: { type: 'array', required: true, items: PATTERN_VIEW_SCHEMA },
    librarySize: { type: 'integer', required: true },
    skills: { type: 'string', required: true },
  },
} as const

/** query_writing_patterns 工具的模型可见描述文案（逐字来自源 tool 文件）。 */
export const QUERY_WRITING_PATTERNS_DESCRIPTION = [
  '- Retrieves the patent and legal writing patterns that fit a drafting or office-action situation, compiled into a `<writing_skills>` block',
  '- A pattern covers one situation with ordered steps and the rules to follow or avoid: claim drafting, specification drafting, disclosure drafting, IPC strategy, embodiment writing, and office-action replies on inventiveness, novelty, and clarity',
  '- Selection: `query` searches by keyword; otherwise `features` match the case features against pattern names, authored keywords, summaries, and step names; otherwise `category` lists that category; with no argument at all the whole library is listed',
  '- Selection is lexical and offline: the tool picks patterns, it does not judge the case. Apply the returned steps to the passage being written',
].join('\n')

/** query_writing_patterns 工具各参数的模型可见描述（逐字来自源 tool 文件）。 */
export const QUERY_WRITING_PATTERNS_PARAMETER_DESCRIPTIONS = {
  category: `Pattern category: ${CATEGORY_DESCRIPTION}`,
  query: 'Search keywords; when set, the call searches by keyword instead of matching case features',
  features: 'Technical features or keywords of the case, e.g. ["创造性三步法", "功能性限定"]',
} as const

/** Label per selection mode, used in the rendered result. */
export const MODE_LABELS: Readonly<Record<QueryWritingPatternsMode, string>> = {
  search: '按关键词检索',
  match: '按案件特征匹配',
  category: '按类目列举',
  catalog: '列举模式库',
}

/** Resolve the result cap: the call's own, else the mode's default. */
export function resolveQueryLimit(limit: number | undefined, matchLimit: number): number {
  if (limit === undefined) return matchLimit
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(`query_writing_patterns: limit must be a positive integer, got ${String(limit)}`)
  }
  return limit
}

/** Which selection the arguments ask for. */
export function selectQueryMode(args: QueryWritingPatternsInput): QueryWritingPatternsMode {
  if (args.query !== undefined && args.query.trim() !== '') return 'search'
  if ((args.features ?? []).some(feature => feature.trim() !== '')) return 'match'
  if (args.category !== undefined) return 'category'
  return 'catalog'
}

/** Run the selection the mode names. */
export function selectQueryPatterns(
  store: PatternStore,
  mode: QueryWritingPatternsMode,
  args: QueryWritingPatternsInput,
  limit: number,
): readonly WritingPattern[] {
  switch (mode) {
    case 'search':
      /* v8 ignore next -- selectQueryMode chooses search only for a non-blank query */
      return store.search(args.query ?? '', {
        ...(args.category !== undefined ? { category: args.category } : {}),
        limit,
      })
    case 'match':
      return store.match({
        ...(args.category !== undefined ? { caseType: args.category } : {}),
        /* v8 ignore next -- selectQueryMode chooses match only when a non-blank feature is present */
        features: (args.features ?? []).filter(feature => feature.trim() !== ''),
        limit,
      })
    case 'category':
      /* v8 ignore next -- selectQueryMode chooses category only when a category is present */
      return store.byCategory(args.category ?? '').slice(0, limit)
    case 'catalog':
      return store.all().slice(0, limit)
    /* v8 ignore start -- closed-union exhaustiveness backstop; selectQueryMode returns only the four cases above */
    default:
      return unreachableMode(mode)
    /* v8 ignore stop */
  }
}

/* v8 ignore start -- closed-union exhaustiveness backstop; only the ignored default can call it */
/** 穷尽性收尾：封闭联合的默认分支不可达（未来新增 mode 时此处编译失败）。 */
function unreachableMode(mode: never): never {
  throw new Error(`未知 query_writing_patterns 选择模式：${String(mode)}`)
}
/* v8 ignore stop */

/** One pattern as the model sees it; its summary lives in the compiled block alone. */
function toView(pattern: WritingPattern): WritingPatternView {
  return {
    id: pattern.id,
    name: pattern.name,
    category: pattern.category,
  }
}

/**
 * The tool handler's deterministic core（源 tool execute 的纯函数化：mode 判定 +
 * limit 解析 + 模式选择 + 视图组装 + 编译）。Throws the same errors the source tool threw.
 * @param store - the loaded pattern corpus.
 * @param args - the tool input.
 * @param matchLimit - cap applied when a narrowed call omits `limit`.
 * @returns the canonical output.
 */
export function buildQueryWritingPatternsOutput(
  store: PatternStore,
  args: QueryWritingPatternsInput,
  matchLimit: number,
): QueryWritingPatternsOutput {
  const mode = selectQueryMode(args)
  const limit = resolveQueryLimit(args.limit, mode === 'catalog' ? store.size : matchLimit)
  const patterns = selectQueryPatterns(store, mode, args, limit)
  return {
    mode,
    patterns: patterns.map(toView),
    librarySize: store.size,
    skills: compileWritingSkills(patterns),
  }
}

/**
 * Render a result as the model-facing text: the selected patterns, then the
 * compiled block that carries their steps and rules.
 * @param _args - the tool arguments (the result already states its selection).
 * @param value - the canonical result.
 * @returns the rendered text.
 */
export function renderQueryWritingPatterns(
  _args: QueryWritingPatternsInput,
  value: QueryWritingPatternsOutput,
): string {
  const label = MODE_LABELS[value.mode]
  if (value.patterns.length === 0) {
    return `写作模式库：没有匹配的模式（库中共 ${String(value.librarySize)} 个）。`
      + '改用其他关键词或类目，或省略全部参数以列举库中的模式。'
  }
  const lines = [
    `写作模式库：命中 ${String(value.patterns.length)} / ${String(value.librarySize)} 个模式（${label}）。`,
    '',
    '匹配到的模式：',
    ...value.patterns.map(pattern =>
      `- \`${pattern.id}\` · ${PATTERN_CATEGORY_LABELS[pattern.category]} · **${pattern.name}**`),
    '',
    '编译后的写作技能：',
    value.skills,
  ]
  return lines.join('\n')
}
