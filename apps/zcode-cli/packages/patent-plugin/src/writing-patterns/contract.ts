/**
 * patent-writing-patterns 对外契约：调用方要想正确调用就必须知道的一切都写在这里；其余对外不可见。
 *
 * 不变量：语料加载 fail-loud（目录不可读、无模式文件、任一字段畸形都抛
 * PatternAssetError 并点名文件）；检索/匹配是词法确定性的，同查询同语料必同结果。
 * 工具输入/输出类型见 tool-types.ts，选择/渲染逻辑与模型可见文案见 tool-logic.ts
 * （P3 的 patent-tools 消费）。无事件、无持久化等待。
 */
import type { PatternStore } from "./pattern-store.js"
import type {
  PatternCategory,
  WritingPattern,
} from "./types.js"
import type {
  QueryWritingPatternsInput,
  QueryWritingPatternsMode,
  QueryWritingPatternsOutput,
} from "./tool-types.js"

export type PatentWritingPatternsId = string & { readonly __brand: "PatentWritingPatternsId" };

export type { PatternCategory, WritingPattern };

/** 撰写模式语料加载、编译与工具选择契约。 */
export interface PatentWritingPatternsContract {
  /** 加载随包（或显式目录）语料为可检索的 PatternStore。 */
  loadPatternStore(dir?: string): PatternStore;
  /** 读取并校验目录内每个 YAML 模式文件，文件名序返回。 */
  loadPatternCorpus(dir: string): readonly WritingPattern[];
  /** 解析单个 YAML 资产为模式列表（单文档或 patterns 列表）。 */
  parsePatternFile(path: string): readonly WritingPattern[];
  /** 把模式编译为一个 <writing_skills> XML 块；空列表返回 ''。 */
  compileWritingSkills(patterns: readonly WritingPattern[]): string;
  /** section 文案：指令散文 + 围栏的编译块；空块只返回散文。 */
  renderWritingSkillsSection(skills: string): string;
  /** section 注入的模式选择：按请求类目顺序、id 序、跨类目去重。 */
  sectionPatterns(store: PatternStore, categories: readonly PatternCategory[]): readonly WritingPattern[];
  /** 工具选择核心：mode 判定 + limit 解析 + 模式选择 + 视图与编译组装。 */
  selectQueryPatterns(
    store: PatternStore,
    mode: QueryWritingPatternsMode,
    args: QueryWritingPatternsInput,
    limit: number,
  ): readonly WritingPattern[];
  /** 工具结果渲染为模型可见文本（命中清单 + 编译块，或未命中指引）。 */
  renderQueryWritingPatterns(args: QueryWritingPatternsInput, value: QueryWritingPatternsOutput): string;
}
