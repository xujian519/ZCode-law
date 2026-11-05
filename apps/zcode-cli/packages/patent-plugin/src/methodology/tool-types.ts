/**
 * triz 工具的输入/输出视图类型（专利域移植）。
 *
 * 来源：DSH `@deepseek-ai/dsh-methodology` 的 `src/tool/triz.ts`。
 * 该文件本是 defineTool 包装器（属 Cordis/dsh-tools 组合层，本期不迁，P3 由
 * patent-tools 重建）；此处只保留其中与运行时无关的输入/输出类型，供 P3 的
 * patent-tools 与测试使用。
 *
 * 语义改动说明：源文件中 `TrizOutput` 由 dsh-tools 的 `InferValue<typeof
 * OUTPUT_SCHEMA>` 从输出 schema 推断得到；剥掉 dsh-tools 依赖后改为显式联合类型，
 * 成员形状与源推断结果逐一对应（catalog/lookup 两分支，mode 为判别字段）。
 */

/** Tool input: an optional improving/worsening parameter pair (both or neither). */
export type TrizInput = {
  /** Improving engineering parameter number, 1-39. */
  improving?: number
  /** Worsening engineering parameter number, 1-39. */
  worsening?: number
}

/** One engineering parameter as returned to the model. */
export type TrizParameterView = {
  number: number
  label: string
}

/** One inventive principle as returned to the model. */
export type TrizPrincipleView = {
  number: number
  name: string
  description: string
}

/** One separation principle as returned to the model. */
export type TrizSeparationView = {
  name: string
  description: string
  signals: string[]
}

/** The catalog branch of {@link TrizOutput}. */
export type TrizCatalogOutput = {
  mode: 'catalog'
  parameters: TrizParameterView[]
  principles: TrizPrincipleView[]
}

/** The matrix-cell branch of {@link TrizOutput}. */
export type TrizLookupOutput = {
  mode: 'lookup'
  improving: TrizParameterView
  worsening: TrizParameterView
  recommended: TrizPrincipleView[]
  separations: TrizSeparationView[]
}

/** The tool's canonical result（对应源实现 InferValue<typeof OUTPUT_SCHEMA> 的显式写法）. */
export type TrizOutput = TrizCatalogOutput | TrizLookupOutput
