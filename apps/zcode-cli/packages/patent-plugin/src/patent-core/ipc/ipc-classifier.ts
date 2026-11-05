import type { IpcClassification } from './types.js'
import type { IpcDomainMeta } from './ipc-domains.js'
export type { IpcClassification } from './types.js'

// 数据表（IPC_DOMAINS / IPC_DETAIL_DOMAINS 及默认常量）原与本文件同处，因源文件
// 807 行超 800 行上限拆至 ipc-domains.ts（见该文件头注释）；以下再导出保持
// index.ts 的 re-export 路径与源包公开导出面一致。
export {
  DEFAULT_IPC_CONFIDENCE,
  DEFAULT_IPC_SECTION,
  IPC_DETAIL_DOMAINS,
  IPC_DOMAINS,
  IPC_NOVELTY_HINT_MAX,
  type IpcDetailDomainMeta,
  type IpcDomainMeta,
} from './ipc-domains.js'

/**
 * IPC 分类器（移植自 Mady domains/ipc/）。
 *
 * 两级关键词规则匹配：先按部（A-H）关键词表扫描文本，对命中部再按高频
 * 大类关键词子表（IPC_DETAIL_DOMAINS）做二次匹配，产出 detail（如 "A61"）。
 * 置信度 = 0.5 + 0.5*(1 - e^(-命中数/K))，只依赖绝对命中数，不受关键词表
 * 长度影响（消除"关键词少的部虚高"）；无匹配时返回默认 B（作业/运输）
 * 和低置信度 0.15。
 */

import {
  DEFAULT_IPC_CONFIDENCE,
  DEFAULT_IPC_SECTION,
  IPC_DETAIL_DOMAINS,
  IPC_DOMAINS,
  IPC_NOVELTY_HINT_MAX,
} from './ipc-domains.js'

const MIN_CONFIDENCE_FOR_KEYWORD = 0.5
/** 高置信度阈值：confidence >= 0.8 视为高置信度。 */
export const HIGH_CONFIDENCE_THRESHOLD = 0.8
/** 置信度饱和函数参数 K（命中 K 词时达到 (1-1/e) ≈ 0.632 的归一化增量）。 */
const CONFIDENCE_SATURATION_K = 3
/** 大类精注入置信度门槛：detailConfidence >= 该值（≈ 大类命中 ≥2 词）才精注入，否则回退部级。 */
export const IPC_DETAIL_MIN_CONFIDENCE = 0.7

/**
 * 返回所有 IPC 大类的关键词匹配结果（含未命中部按置信度排序；命中部附两级 detail）。
 * @param text - 待分类的专利文本。
 * @returns 按置信度降序排列的 IPC 分类结果列表。
 */
export function classifyIpc(text: string): IpcClassification[] {
  const results: IpcClassification[] = []
  const lowered = text.toLowerCase()

  for (const domain of IPC_DOMAINS) {
    const matched = matchKeywordsInText(lowered, domain.keywords)
    if (matched.length === 0) continue
    const confidence = ipcConfidence(matched.length)
    const detail = matchIpcDetail(lowered, domain.section)
    results.push({
      section: domain.section,
      confidence,
      matchedKeywords: matched,
      noveltyImplications: domain.inventivenessFocus.slice(0, IPC_NOVELTY_HINT_MAX),
      ...detail,
    })
  }

  if (results.length === 0) {
    return [{ section: DEFAULT_IPC_SECTION, confidence: DEFAULT_IPC_CONFIDENCE, matchedKeywords: [] }]
  }
  return results.sort((a, b) => b.confidence - a.confidence)
}

/**
 * 两级分类第二级：在部内对高频大类关键词子表做二次匹配，
 * 取置信度最高的大类；大类命中 ≥1 词才产出（供消费方按 IPC_DETAIL_MIN_CONFIDENCE 判定精注入）。
 */
function matchIpcDetail(text: string, section: string): { detail: string; detailConfidence: number } | undefined {
  let best: { detail: string; detailConfidence: number } | undefined
  for (const detailDomain of IPC_DETAIL_DOMAINS) {
    if (detailDomain.section !== section) continue
    const hits = matchKeywordsInText(text, detailDomain.keywords).length
    if (hits === 0) continue
    const detailConfidence = ipcConfidence(hits)
    if (!best || detailConfidence > best.detailConfidence) {
      best = { detail: detailDomain.detail, detailConfidence }
    }
  }
  return best
}

/** 置信度：0.5 + 0.5*(1 - e^(-hits/K))。饱和函数只依赖绝对命中数，消除关键词表长度偏差。 */
function ipcConfidence(hits: number): number {
  return Math.min(MIN_CONFIDENCE_FOR_KEYWORD + 0.5 * (1 - Math.exp(-hits / CONFIDENCE_SATURATION_K)), 1.0)
}

/**
 * 返回单个最佳分类（与 Mady Classify 一致）。
 * @param text - 待分类的专利文本。
 * @returns 置信度最高的 IPC 分类。
 */
export function classifyIpcTop(text: string): IpcClassification {
  const [top] = classifyIpc(text)
  // classifyIpc 恒返回至少一个分类（无匹配时默认 B）；缺省分支仅为满足 TS 收窄。
  /* v8 ignore next -- classifyIpc always returns at least the default section */
  return top ?? { section: DEFAULT_IPC_SECTION, confidence: DEFAULT_IPC_CONFIDENCE, matchedKeywords: [] }
}

/**
 * 判断置信度是否为高（>= 0.80）。
 * @param confidence - 待判断的置信度。
 * @returns 是否为高置信度。
 */
export function isHighConfidence(confidence: number): boolean {
  return confidence >= HIGH_CONFIDENCE_THRESHOLD
}

/**
 * 获取某个 IPC 部的领域元数据。
 * @param section - IPC 部号（A-H，大小写不敏感）。
 * @returns 对应的领域元数据，未找到返回 undefined。
 */
export function getIpcDomain(section: string): IpcDomainMeta | undefined {
  return IPC_DOMAINS.find(d => d.section === section.toUpperCase())
}

function matchKeywordsInText(text: string, keywords: string[]): string[] {
  const matched: string[] = []
  for (const kw of keywords) {
    // text 已在 classifyIpc 中 toLowerCase；关键词表可能含大写 ASCII
    // （GPS/LED 等），统一转小写匹配避免永不命中
    if (text.includes(kw.toLowerCase())) matched.push(kw)
  }
  return matched
}
