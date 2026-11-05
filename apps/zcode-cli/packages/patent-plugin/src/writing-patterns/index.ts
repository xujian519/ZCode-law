/**
 * patent-writing-patterns 公共入口（专利域移植，源：@deepseek-ai/dsh-writing-patterns）。
 *
 * 撰写模式语料纯库：YAML 语料的加载与校验（fail-loud）、词法检索/案件特征匹配、
 * `<writing_skills>` 技能编译、system-prompt section 文案与组装，以及
 * query_writing_patterns 工具的确定性逻辑/类型/schema 常量。
 *
 * 未迁部分（源 src/index.ts 的 Cordis 函数插件壳，按移植规则不迁）：
 * - `name` / `inject` / `Config`（schemastery）/ `apply(ctx, config)` 插件导出；
 * - apply() 内的语料启动加载调用点、`query_writing_patterns` 工具注册与
 *   `writing-patterns:skills` system-prompt section 注册（ZCode 侧由 P3 的
 *   patent-tools 与插件组装层依 tool-logic.ts 重建）。
 * 相对 import 已按 NodeNext ESM 改写为 `.js` 后缀。
 */
export { PATTERN_FILE_SUFFIXES, patternDir } from './asset-location.js'
export {
  loadPatternCorpus,
  loadPatternStore,
  parsePatternFile,
  PatternStore,
  patternKeywords,
  type PatternMatchSpec,
  type PatternSearchSpec,
} from './pattern-store.js'
export { compileWritingSkills, escapeXmlText } from './skill-compiler.js'
export {
  renderWritingSkillsSection,
  sectionPatterns,
  WRITING_PATTERNS_PROMPT_TEXT,
  WRITING_PATTERNS_SECTION_NAME,
} from './prompt.js'
export type {
  QueryWritingPatternsInput,
  QueryWritingPatternsMode,
  QueryWritingPatternsOutput,
  QueryWritingPatternsToolOptions,
  WritingPatternView,
} from './tool-types.js'
export {
  buildQueryWritingPatternsOutput,
  renderQueryWritingPatterns,
  resolveQueryLimit,
  selectQueryMode,
  selectQueryPatterns,
  MODE_LABELS,
  CATEGORY_DESCRIPTION,
  PATTERN_VIEW_SCHEMA,
  QUERY_WRITING_PATTERNS_OUTPUT_SCHEMA,
  QUERY_WRITING_PATTERNS_DESCRIPTION,
  QUERY_WRITING_PATTERNS_PARAMETER_DESCRIPTIONS,
} from './tool-logic.js'
export {
  DEFAULT_PATTERN_QUALITY,
  isPatternCategory,
  PATTERN_CATEGORIES,
  PATTERN_CATEGORY_LABELS,
  PatternAssetError,
  WritingPatternError,
  type PatternCategory,
  type PatternExample,
  type PatternPrinciple,
  type PatternStep,
  type WritingPattern,
} from './types.js'
