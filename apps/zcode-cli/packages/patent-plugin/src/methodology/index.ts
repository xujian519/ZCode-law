/**
 * patent-methodology 公共入口（专利域移植，源：@deepseek-ai/dsh-methodology）。
 *
 * TRIZ 推理层纯库：40 个发明原理、39×39 矛盾矩阵、分离原理的查表数据访问，
 * 以及 triz 工具的确定性逻辑/类型/schema 常量。
 *
 * 未迁部分（源 src/index.ts 的 Cordis 函数插件壳，按移植规则不迁）：
 * - `name` / `inject` / `Config`（schemastery）/ `apply(ctx, config)` 插件导出；
 * - apply() 内的资产启动校验调用点与 `tool:triz` system-prompt section 注册
 *   （ZCode 侧由 P3 的 patent-tools 与插件组装层按 tool-logic.ts 重建）。
 * 相对 import 已按 NodeNext ESM 改写为 `.js` 后缀。
 */
export {
  loadMatrix,
  lookupMatrixCell,
  loadPrinciples,
  loadSeparations,
  validateTrizAssets,
  ENGINEERING_PARAMS,
  paramLabel,
  principleById,
  principleNames,
  type TrizAssets,
} from './data.js'
export { TRIZ_PROMPT_TEXT } from './prompt.js'
export type { TrizPrinciple, TrizParameter, TrizSeparation } from './types.js'
export type {
  TrizInput,
  TrizOutput,
  TrizCatalogOutput,
  TrizLookupOutput,
  TrizParameterView,
  TrizPrincipleView,
  TrizSeparationView,
} from './tool-types.js'
export {
  buildTrizOutput,
  buildTrizCatalog,
  buildTrizLookup,
  renderTriz,
  TRIZ_OUTPUT_SCHEMA,
  PARAMETER_VIEW_SCHEMA,
  PRINCIPLE_VIEW_SCHEMA,
  SEPARATION_VIEW_SCHEMA,
  TRIZ_TOOL_DESCRIPTION,
  TRIZ_IMPROVING_DESCRIPTION,
  TRIZ_WORSENING_DESCRIPTION,
} from './tool-logic.js'
