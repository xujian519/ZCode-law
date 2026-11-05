/**
 * triz 工具的确定性逻辑与模型可见文案（专利域移植）。
 *
 * 来源：DSH `@deepseek-ai/dsh-methodology` 的 `src/tool/triz.ts`。
 * 源文件是 defineTool 包装器，其中 handler 为「参数校验 + 调 data.ts 纯函数 +
 * 组装输出」，不含 LLM 调用与 IO；按移植规则整段抽为纯逻辑，P3 的 patent-tools
 * 重建 `triz` 工具时直接复用本文件的输出构建与渲染，保证模型可见文本逐字一致。
 * 未迁部分：defineTool 注册壳（name/parameters/output.render/isConcurrencySafe）
 * 由 P3 依本文件导出的 schema 常量重建。
 */

import { ENGINEERING_PARAMS, loadPrinciples, loadSeparations, lookupMatrixCell, paramLabel, principleById } from './data.js'
import type { TrizPrinciple, TrizSeparation } from './types.js'
import type {
  TrizInput,
  TrizLookupOutput,
  TrizCatalogOutput,
  TrizParameterView,
  TrizPrincipleView,
  TrizSeparationView,
} from './tool-types.js'

/** 输出 schema 的视图常量（纯数据，原样来自源 tool 文件；P3 注册工具时引用）。 */
export const PARAMETER_VIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    number: { type: 'integer', required: true },
    label: { type: 'string', required: true },
  },
} as const

/** 输出 schema 的原理视图常量（纯数据，原样来自源 tool 文件）。 */
export const PRINCIPLE_VIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    number: { type: 'integer', required: true },
    name: { type: 'string', required: true },
    description: { type: 'string', required: true },
  },
} as const

/** 输出 schema 的分离原理视图常量（纯数据，原样来自源 tool 文件）。 */
export const SEPARATION_VIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', required: true },
    description: { type: 'string', required: true },
    signals: { type: 'array', required: true, items: { type: 'string' } },
  },
} as const

const CATALOG_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: { type: 'string', const: 'catalog', required: true },
    parameters: { type: 'array', required: true, items: PARAMETER_VIEW_SCHEMA },
    principles: { type: 'array', required: true, items: PRINCIPLE_VIEW_SCHEMA },
  },
} as const

const LOOKUP_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mode: { type: 'string', const: 'lookup', required: true },
    improving: { ...PARAMETER_VIEW_SCHEMA, required: true },
    worsening: { ...PARAMETER_VIEW_SCHEMA, required: true },
    recommended: { type: 'array', required: true, items: PRINCIPLE_VIEW_SCHEMA },
    separations: { type: 'array', required: true, items: SEPARATION_VIEW_SCHEMA },
  },
} as const

/** triz 工具的输出 schema（纯数据，原样来自源 tool 文件；P3 注册工具时引用）。 */
export const TRIZ_OUTPUT_SCHEMA = {
  oneOf: [CATALOG_OUTPUT_SCHEMA, LOOKUP_OUTPUT_SCHEMA],
} as const

/** triz 工具的模型可见描述文案（逐字来自源 tool 文件）。 */
export const TRIZ_TOOL_DESCRIPTION = [
  '- TRIZ inventive problem solving: the 40 inventive principles and the 39x39 Altshuller contradiction matrix',
  '- Call with no arguments to list all 39 engineering parameters and 40 principles',
  '- Call with an improving and a worsening parameter number (1-39) to read that matrix cell and its recommended principles',
  '- Use for technical contradictions, trade-offs, and patent design-around',
  '- This tool only reads the matrix for explicit parameter numbers; extracting parameters or contradictions from a document is outside its scope',
].join('\n')

/** triz 工具 improving 参数的模型可见描述（逐字来自源 tool 文件）。 */
export const TRIZ_IMPROVING_DESCRIPTION =
  'Improving engineering parameter number (1-39). Omit it together with worsening to list the full catalog.'

/** triz 工具 worsening 参数的模型可见描述（逐字来自源 tool 文件）。 */
export const TRIZ_WORSENING_DESCRIPTION =
  'Worsening engineering parameter number (1-39). Provide it only together with improving.'

function parameterView(no: number): TrizParameterView {
  return { number: no, label: paramLabel(no) }
}

function principleView(principle: TrizPrinciple): TrizPrincipleView {
  return { number: principle.no, name: principle.name, description: principle.description }
}

function separationView(separation: TrizSeparation): TrizSeparationView {
  return {
    name: separation.name,
    description: separation.description,
    signals: separation.signals,
  }
}

function allSeparations(): TrizSeparationView[] {
  return loadSeparations().map(separationView)
}

function allParameters(): TrizParameterView[] {
  return ENGINEERING_PARAMS.map(param => parameterView(param.no))
}

function allPrinciples(): TrizPrincipleView[] {
  return loadPrinciples().map(principleView)
}

/** Build the full-catalog branch（源 tool execute 的无参分支，逐字保留）。 */
export function buildTrizCatalog(): TrizCatalogOutput {
  return { mode: 'catalog', parameters: allParameters(), principles: allPrinciples() }
}

/**
 * Build the matrix-cell lookup branch（源 tool execute 的查表分支，逐字保留）。
 * @param improving - improving engineering parameter number, 1-39.
 * @param worsening - worsening engineering parameter number, 1-39.
 */
export function buildTrizLookup(improving: number, worsening: number): TrizLookupOutput {
  if (!Number.isInteger(improving) || improving < 1 || improving > 39) {
    throw new Error('triz improving must be an integer 1-39')
  }
  if (!Number.isInteger(worsening) || worsening < 1 || worsening > 39) {
    throw new Error('triz worsening must be an integer 1-39')
  }
  const ids = lookupMatrixCell(improving, worsening)
  return {
    mode: 'lookup',
    improving: parameterView(improving),
    worsening: parameterView(worsening),
    recommended: ids.flatMap((id) => {
      const principle = principleById(id)
      return principle === undefined ? [] : [principleView(principle)]
    }),
    separations: improving === worsening ? allSeparations() : [],
  }
}

/**
 * The tool handler's deterministic core（源 tool execute 的纯函数化：参数解析 +
 * 分支校验 + 输出组装）。Throws the same errors the source tool threw.
 * @param args - the tool input; both parameters or neither.
 * @returns the canonical catalog or lookup output.
 */
export function buildTrizOutput(args: TrizInput): TrizCatalogOutput | TrizLookupOutput {
  if (args.improving === undefined && args.worsening === undefined) {
    return buildTrizCatalog()
  }
  if (args.improving === undefined || args.worsening === undefined) {
    throw new Error('triz requires both improving and worsening, or neither (for the full catalog)')
  }
  return buildTrizLookup(args.improving, args.worsening)
}

/** Render the full catalog as Markdown. */
function renderCatalog(value: TrizCatalogOutput): string {
  const lines = [
    'TRIZ: 39 engineering parameters and 40 inventive principles.',
    '',
    '## Engineering parameters',
    ...value.parameters.map(param => `- ${param.number}. ${param.label}`),
    '',
    '## Inventive principles',
    ...value.principles.map(principle => `- ${principle.number}. ${principle.name} — ${principle.description}`),
  ]
  return lines.join('\n')
}

/** Render one matrix-cell lookup as Markdown. */
function renderLookup(value: TrizLookupOutput): string {
  const header = `Contradiction matrix: improving ${value.improving.label} (${value.improving.number}) → worsening ${value.worsening.label} (${value.worsening.number})`
  if (value.recommended.length === 0) {
    // 空单元有两种：对角线（同一参数即物理矛盾）与转写本身就留空的非对角线格。
    // 只有前者是物理矛盾；把 234 个非对角线空格也说成物理矛盾会把结论引向错误方向。
    if (value.improving.number === value.worsening.number) {
      return [
        header,
        '',
        'Recommended principles: none. This is a diagonal cell: improving equals worsening, a physical contradiction that classical TRIZ resolves by separation rather than a matrix entry.',
        '',
        'Separation principles:',
        ...value.separations.map(separation => `- ${separation.name} — ${separation.description} Signals: ${separation.signals.join('; ')}`),
      ].join('\n')
    }
    const empty = 'The classical matrix lists no recommendation for this pair. This is not a diagonal cell, so a separation move does not apply; check whether the pair names the parameters actually in conflict.'
    return `${header}\n\nRecommended principles: none. ${empty}`
  }
  const lines = [
    header,
    '',
    'Recommended principles: ' + value.recommended.map(principle => principle.number).join(', '),
    '',
    ...value.recommended.map(principle => `- ${principle.number}. ${principle.name} — ${principle.description}`),
  ]
  return lines.join('\n')
}

/** Render the canonical value into model-facing Markdown（源 output.render 的纯函数核心）. */
export function renderTriz(value: TrizCatalogOutput | TrizLookupOutput): string {
  switch (value.mode) {
    case 'catalog':
      return renderCatalog(value)
    case 'lookup':
      return renderLookup(value)
    default:
      return exhaustiveMode(value)
  }
}

/** 穷尽性收尾：封闭联合的默认分支不可达（未来新增 mode 时此处编译失败）。 */
function exhaustiveMode(value: never): never {
  throw new Error(`未知 TrizOutput mode: ${String((value as { mode: unknown }).mode)}`)
}
