/**
 * patent-core —— 纯 TypeScript 专利领域库（无 ctx 依赖，剥除 Cordis 耦合）。
 *
 * 迁入自 DSH `@deepseek-ai/dsh-patent-core`（Phase 2 移植）：atoms
 * StageProvider/StageHandler 词汇、ModelPort LLM 适配器、规则协议类型 + 文本工具、
 * checker 双轨规则引擎、problem 原子化检查、evidence 证据闭环账本/引擎、reasoning
 * 结构化推理、claim-chart 引擎、claim-coverage 撰写自检、draft 受控撰写模型与校验、
 * IPC 分类/审查标准查询，以及持久化/路径辅助。
 *
 * 未迁移：Cordis 插件壳（name/inject/Config/apply、schemastery）——本库在 DSH
 * 侧即无插件壳（源 index.ts 已是纯 barrel），ZCode 侧按 docs/patent-domain/architecture.md
 * 以 managed module（domain 层）登记，装配由 patent-server（adapters 层）负责。
 * DSH workspace 依赖以本地等价物替代：utils.ts（assertNever/isRecord/asRecord）、
 * harness-bridge.ts（LLM/attachment 词汇镜像，语义反转见 docs/patent-domain/tools.md）。
 * @module patent-core
 */

// Patent-domain model port contract + adapter.
export type {
  PatentModelEvent,
  PatentModelMessage,
  PatentModelPort,
  PatentModelRequest,
  PatentModelUsage,
  StageProvider,
  StageSearchHit,
} from './types.js'
export { collectPortText, createLlmModelPort } from './model-port.js'
export type { CreateLlmModelPortOptions } from './model-port.js'

// LLM JSON tolerant parsing + the shared JSON-value narrowing guards.
export {
  asJsonArray,
  asJsonRecord,
  isJsonRecord,
  parseJsonRecordArray,
  parseJsonStringArray,
  parseOptionalJsonStringArray,
  readJsonNumber,
  readJsonString,
  readJsonStringArray,
  stripCodeFence,
  tryParseJson,
  type JsonRecordArrayResult,
  type JsonStringArrayResult,
} from './llm-json.js'

// Controlled draft model + validation: the model submits structured drafts
// (no HTML); converters generate headings and tables from the structure.
export {
  DraftValidationError,
  SPEC_PART_HEADINGS,
  SPEC_PART_ORDER,
  formatTableCaption,
  numberedFigureDescriptions,
  validateSpecDraft,
  validateTemplateDraft,
} from './draft/index.js'
export type {
  DraftBlock,
  DraftGroundItem,
  NumberedFigureDescription,
  SpecDraft,
  SpecDraftMeta,
  SpecPartId,
  TemplateChoiceOption,
  TemplateDraft,
  TemplateDraftSchema,
  TemplateDraftSection,
  TemplateFieldSlot,
  TemplateSectionSlot,
} from './draft/index.js'

// Prompt-injection isolation for untrusted text spliced into LLM prompts.
export { dataBlock } from './prompt-hygiene.js'

// Constitutional rule engine protocol types + text utilities.
export type {
  CitationAnalysisCheck,
  ConstitutionalRule,
  KeywordBlocklistCheck,
  LoadedRuleSet,
  NoticeGroundCoverageCheck,
  PatternAnalysisCheck,
  QuoteRepetitionCheck,
  RuleAction,
  RuleCheck,
  RuleCheckType,
  RuleEvaluation,
  RuleOutputGate,
  RuleOutputGateResult,
  RuleSet,
  RuleSetValidationIssue,
  RuleSeverity,
  RuleViolation,
  StructuralAnalysisCheck,
  StructuralElement,
  SynonymMatchCheck,
  SynonymRequirement,
  UnraisedStatuteCitationCheck,
} from './rule/types.js'
export {
  DEFAULT_NEGATION_WINDOW,
  DEFAULT_NEGATION_WORDS,
  hasNegationContext,
  locateMatch,
  locationAt,
  parseCnNumber,
  runeSlice,
} from './rule/text-utils.js'
export type { MatchLocation, NegationContextOptions } from './rule/text-utils.js'

// Atoms: the StageProvider/StageHandler vocabulary and the builtin handlers.
export * from './atoms/index.js'

// Claim-chart engine (element validation / mapping / gap / pin-cite / store).
export * from './claim-chart/index.js'

// Claim-drafting self-checks: claim unity (A31.1) and the claim-to-embodiment coverage matrix.
export * from './claim-coverage/index.js'

// Patent analysis product contract + deterministic aggregator (Athena-inspired report).
export * from './analysis-report/index.js'

// Dual-track deterministic checker (novelty/inventiveness/infringement/...).
export * from './checker/index.js'

// Atomic technical-problem checks (creative-analysis three-step step 2).
export * from './problem/index.js'

// TRIZ contradiction analysis for the inventor side: disclosure gaps and
// candidate solution directions. Never a three-step-step-2 problem statement.
export * from './triz/index.js'

// Evidence closed-loop: receipt ledger, spans, binding, conflict, judgment engine.
export * from './evidence/index.js'

// Structured reasoning primitives: fact blackboard + syllogism.
export * from './reasoning/index.js'

// Persistence + path helpers.
export { JsonFileStore, SAFE_ID_PATTERN, assertSafeId, assertSafePathSegment, atomicWriteJson } from './persist-utils.js'
export {
  CASE_OUTPUTS_REL,
  CASE_ROOT_REL,
  CASE_WORKFLOW_RUNS_REL,
  caseOutputsDir,
  caseWorkflowRunsDir,
} from './paths.js'

// Shared conventions of the two PDF download tools (body verification + dated output dir).
export {
  MIN_PDF_BYTES,
  PDF_MAGIC,
  datedOutputDir,
  inspectPdfBody,
  isHtmlContentType,
  resolveDatedOutputDir,
} from './pdf-download.js'
export type { PdfBodyFault } from './pdf-download.js'

// IPC classification + examination-standard lookup.
export {
  DEFAULT_IPC_CONFIDENCE,
  DEFAULT_IPC_SECTION,
  HIGH_CONFIDENCE_THRESHOLD,
  IPC_DETAIL_DOMAINS,
  IPC_DETAIL_MIN_CONFIDENCE,
  IPC_DOMAINS,
  classifyIpc,
  classifyIpcTop,
  getIpcDomain,
  isHighConfidence,
} from './ipc/ipc-classifier.js'
export type { IpcDetailDomainMeta, IpcDomainMeta } from './ipc/ipc-classifier.js'
export {
  formatStandardsAsContext,
  loadIpcStandards,
  queryByArticle,
  queryIpcDetail,
  queryIpcStandards,
  searchStandards,
} from './ipc/ipc-standards-loader.js'
export type { IpcStandardsIndex } from './ipc/ipc-standards-loader.js'
export type { IpcClassification, IpcStandardCard } from './ipc/types.js'
// Graph engine (Pregel-style superstep) + the three patentability subgraphs.
export * from './graph/index.js'

// Deterministic numeric-range novelty check, run beside the LLM semantic track.
export * from './novelty/index.js'

// Deterministic parsers for procedure documents (office action, invalidation /
// reexamination / design grounds).
export * from './notice/index.js'

// Response preparation: per-claim amendment plan for an office action and the
// reexamination preparation sections.
export * from './response/index.js'

// Deterministic infringement kernel: all-elements coverage, equivalence
// consistency, weighted risk grading.
export * from './infringement/index.js'

// The atoms barrel and the graph barrel both re-export the structurally identical
// state readers getStateString / getStateArray; pin the atoms copies so the
// star-export collision does not silently drop them from this package's surface.
export { getStateString, getStateArray } from './atoms/handler.js'

// Workflow manifest contract, pre-positioned so the graph adapter (manifestToGraph)
// has no dependency on the P3.1 workflow executor. The runWorkflow executor and
// builtin manifests land in patent-workflow and re-import these from here.
export { validateWorkflowManifest } from './workflow/manifest.js'
export { countWorkflowLlmStages, validateWorkflowBudget } from './workflow/budget.js'
export type { WorkflowStageBudget } from './workflow/budget.js'
export { compileSignal, signalMatches } from './workflow/signal.js'
export { clearStageOutputs } from './workflow/stage-outputs.js'
export type { ClearStageOutputsOptions } from './workflow/stage-outputs.js'
export { WorkflowError } from './workflow/types.js'
export type {
  StageExecutor,
  WorkflowContext,
  WorkflowInterrupt,
  WorkflowManifest,
  WorkflowRunOptions,
  WorkflowRunResult,
  WorkflowRunStore,
  WorkflowStage,
  WorkflowStageResult,
  WorkflowStrategy,
} from './workflow/types.js'
