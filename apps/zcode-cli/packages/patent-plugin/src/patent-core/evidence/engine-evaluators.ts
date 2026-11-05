/**
 * 证据判定辅助函数集（自 engine.ts 按职责拆分）。
 *
 * 拆分说明（移植规则 7）：源文件 src/evidence/engine.ts 共 958 行，超过单文件
 * 800 行上限；按「判定辅助函数 / 规则条件评估 + 引擎类」职责拆分为
 * engine-evaluators.ts（本文件：三性评分、类型特定判定、指示符/否定窗口匹配、
 * 使用公开四要件）与 engine.ts（规则条件评估 + EvidenceEngine 类）。
 * 公开导出面由 engine.ts 再导出保持与源包一致。
 *
 * 判定只使用证据记录本身与调用方声明的外部输入：自报字段（哈希、证据类型标签）
 * 不作为采信依据——哈希只在调用方声明已独立核验时计入真实性，证据类型标签不
 * 代替公证文书、来源域名等可核对外部记载。
 */

import {
  determinePublicationDate,
  extractDateFromText,
  inferredMonthEnd,
  isBeforeReferenceDate,
  isMonthOnlyDate,
  isPreciseDate,
  parseDateFlexible,
  type PriorArtReference,
} from './date.js'
import { credibilityToScore, evaluatePublicIntent, platformCategory, platformCredibility } from './credibility.js'
import type { EvidenceSpan } from './span.js'
import type {
  ContentIntegrityStatus,
  DateDetermination,
  DimensionJudgment,
  ElementResult,
  EvidenceExternalInputs,
  EvidenceType,
  FourElementsResult,
  TypeSpecificJudgment,
} from './types.js'

const LEVEL_HIGH = 'high'
const LEVEL_MEDIUM_HIGH = 'medium_high'
const LEVEL_MEDIUM = 'medium'
const LEVEL_LOW = 'low'

export function levelFor(score: number, thresholds: Array<{ min: number; level: string }>, fallback: string): string {
  for (const t of thresholds) {
    if (score >= t.min) return t.level
  }
  return fallback
}

/** 字段是否填写了非空白内容。 */
export function hasText(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== ''
}

/** 三性评分基线：证据记录本身的完备度起点，不含任何加分。 */
const TRIPLE_ATTRIBUTE_BASE = 0.5

// ---------------------------------------------------------------------------
// 三性判定（对齐 Mady evaluateRelevance / evaluateLegality / evaluateAuthenticity）
// ---------------------------------------------------------------------------

export function evaluateRelevance(span: EvidenceSpan): DimensionJudgment {
  let score = TRIPLE_ATTRIBUTE_BASE
  if (hasText(span.sourceUri)) score += 0.1
  if ((span.claimRefs?.length ?? 0) > 0) score += 0.2
  if (span.direction === 'supporting' || span.direction === 'contradicting') score += 0.1
  if (hasText(span.snippet)) score += 0.1
  score = Math.min(score, 1.0)
  return {
    dimension: 'relevance',
    score,
    level: levelFor(
      score,
      [
        { min: 0.85, level: LEVEL_HIGH },
        { min: 0.65, level: LEVEL_MEDIUM_HIGH },
        { min: 0.45, level: LEVEL_MEDIUM },
      ],
      LEVEL_LOW,
    ),
    reasoning: '相关性评估完成',
  }
}

/**
 * 真实性评分。只有当事人自报字段可用的，一律按记录完备度计分：内容哈希在判定阶段无法
 * 重算，只在调用方声明已独立核验（`integrityVerified`）时才计入。
 */
export function evaluateAuthenticity(span: EvidenceSpan, external: EvidenceExternalInputs): DimensionJudgment {
  let score = TRIPLE_ATTRIBUTE_BASE
  if (hasText(span.docVersion)) score += 0.1
  if (hasText(span.contentHash) && external.integrityVerified === true) score += 0.3
  score = Math.min(score, 1.0)
  return {
    dimension: 'authenticity',
    score,
    level: levelFor(
      score,
      [
        { min: 0.85, level: LEVEL_HIGH },
        { min: 0.65, level: LEVEL_MEDIUM_HIGH },
      ],
      LEVEL_LOW,
    ),
    reasoning: '真实性评估完成',
  }
}

/**
 * 合法性评分。来源记录是唯一可核对的输入：内容哈希与合法性无关（哈希证明内容未被改动，
 * 不证明取证合法），不作为合法性的加分项。
 */
export function evaluateLegality(span: EvidenceSpan): DimensionJudgment {
  const score = hasText(span.sourceUri) ? 0.7 : TRIPLE_ATTRIBUTE_BASE
  return {
    dimension: 'legality',
    score,
    level: levelFor(
      score,
      [
        { min: 0.85, level: LEVEL_HIGH },
        { min: 0.65, level: LEVEL_MEDIUM_HIGH },
      ],
      LEVEL_LOW,
    ),
    reasoning: '合法性评估完成',
  }
}

// ---------------------------------------------------------------------------
// 类型特定判定（对齐 Mady evaluateTypeSpecific + 使用公开辅助函数）
// ---------------------------------------------------------------------------

/**
 * 从证据特征推断证据类型；显式类型优先，否则按 URI scheme/内容启发式。
 * @param span - 证据实体。
 * @returns 推断出的证据类型。
 */
export function inferEvidenceType(span: EvidenceSpan): EvidenceType {
  const uri = span.sourceUri ?? ''
  if (uri.startsWith('web_pub:') || uri.startsWith('http_archive:')) return 'internet_publication'
  // web: 是工具文档约定的默认格式（"web:https://…判定平台可信度"）：网络来源
  // 走互联网公开类型特定检查（公开日/平台可信度/完整性/公开意图），
  // 而不是落回 general 仅做三性启发式评分。
  if (uri.startsWith('web:')) return 'internet_publication'
  if (uri.startsWith('pub_use:') || uri.startsWith('public_use:')) return 'public_use'
  if (uri.startsWith('witness:')) return 'witness_testimony'
  if (uri.startsWith('patent:') || uri.startsWith('prior_art:')) return 'prior_art_date'
  if (uri.startsWith('notary:') || uri.includes('notariz')) return 'notarial_certificate'
  return 'general'
}

/**
 * 内容完整性状态。当事人自报的哈希串只是可核验锚点，判定路径不重算哈希，因此仅有哈希
 * 记为 `partial`（部分验证）；只有调用方声明已独立核验（`integrityVerified`）才记
 * `verified`。
 */
function evaluateContentIntegrity(span: EvidenceSpan, external: EvidenceExternalInputs): ContentIntegrityStatus {
  if (!hasText(span.contentHash)) return 'unverified'
  return external.integrityVerified === true ? 'verified' : 'partial'
}

/** 互联网公开日期推定（页面标注日期 > Wayback Machine）。 */
function determineInternetPublicationDate(span: EvidenceSpan, reference?: PriorArtReference): DateDetermination {
  return determinePublicationDate(span.docVersion, span.sourceUri, reference)
}

export function evaluateTypeSpecific(
  span: EvidenceSpan,
  evType: EvidenceType,
  external: EvidenceExternalInputs,
  reference?: PriorArtReference,
): TypeSpecificJudgment {
  const ts: TypeSpecificJudgment = { evidenceType: evType }
  const uri = span.sourceUri ?? ''

  switch (evType) {
    case 'electronic': {
      const level = platformCredibility(uri)
      ts.platformCredibility = level
      ts.credibilityScore = credibilityToScore(level)
      break
    }
    case 'foreign_language':
      ts.translationStatus = 'unknown'
      break
    case 'notarial_certificate':
      // 声明证据类型不等于公证已完成：公证状态只来自公证文书记载（外部输入 notarized）。
      ts.notarizationStatus = external.notarized === true ? 'confirmed' : 'unverified'
      break
    case 'witness_testimony':
      ts.witnessCredibility = 'medium'
      break
    case 'common_knowledge':
      ts.exemptionApplied = '无需举证'
      break
    case 'prior_art_date':
      ts.dateDetermination = determineInternetPublicationDate(span, reference)
      break
    case 'internet_publication': {
      ts.dateDetermination = determineInternetPublicationDate(span, reference)
      const level = platformCredibility(uri)
      ts.platformCredibility = level
      ts.credibilityScore = credibilityToScore(level)
      ts.platformCategory = platformCategory(uri)
      ts.contentIntegrity = evaluateContentIntegrity(span, external)
      ts.publicIntent = evaluatePublicIntent(uri)
      break
    }
    case 'public_use': {
      ts.dateDetermination = determinePublicUseDate(span, reference)
      ts.fourElementsCheck = evaluateFourElements(span)
      ts.burdenDifficulty = assessBurdenDifficulty(ts.fourElementsCheck)
      ts.chainIntegrity = assessChainIntegrity(span, external, ts.fourElementsCheck)
      break
    }
    default:
      break
  }
  return ts
}

/** 使用公开日期推定（主张日期 > 描述文本提取）。 */
function determinePublicUseDate(span: EvidenceSpan, reference?: PriorArtReference): DateDetermination {
  const result: DateDetermination = {
    sourceDate: span.docVersion ?? '',
    determined: 'unknown',
    method: 'public_use',
    isPriorArt: false,
    ...(reference !== undefined ? { referenceDate: reference.date, referenceBasis: reference.basis } : {}),
    reliability: 'low',
    sourceType: 'claimed_date',
  }
  if (span.docVersion !== undefined && span.docVersion !== '') {
    const parsed = parseDateFlexible(span.docVersion)
    if (parsed !== null) {
      /* v8 ignore else -- every parseDateFlexible-parseable string is precise or month-only, so the else-if chain's else arm is dead */
      if (isPreciseDate(span.docVersion)) {
        // 精确日期（含英文月份格式 "Jan 15, 2023"）：直接采用，不得截为年-月
        result.determined = span.docVersion
        result.reliability = 'medium'
      } else if (isMonthOnlyDate(span.docVersion)) {
        result.determined = inferredMonthEnd(parsed)
        result.reliability = 'low'
      } else {
        // 可解析但精度不足的日期：保留解析值（不再落 "unknown"）
        result.determined = span.docVersion
        result.reliability = 'low'
      }
      result.isPriorArt = isBeforeReferenceDate(result.determined, reference?.date)
      return result
    }
  }
  const extracted = extractDateFromText(span.snippet ?? '')
  if (extracted !== '') {
    result.sourceDate = extracted
    result.determined = extracted
    result.reliability = 'low'
    result.sourceType = 'inferred'
    result.isPriorArt = isBeforeReferenceDate(extracted, reference?.date)
  }
  return result
}

/** 拉丁词指示符：按词边界匹配，避免 "us" 命中 because / use 这类子串。 */
const LATIN_INDICATOR_RE = /^[a-z][a-z -]*$/

/** 否定标记：出现在指示符之前时，片段是在否认该事实，不能按肯定认定。 */
const NEGATION_MARKERS = ['尚未', '未', '没有', '不存在', '无', '不得', '不', '非', 'not ', 'no ', 'without ', "n't "]

/** 含「不／无」但不表示否定的常见组合，判定前先从否定窗口剔除。 */
const NEGATION_EXEMPT = ['不过', '不但', '不仅', '不只', '不单', '不无', '无不', 'not only']

/** 否定作用窗口：中文指示符前 6 字内出现否定标记即视为该处被否定。按窗口判定是近似——
 * 「无锡」「无论」这类词里的「无」也会算作否定，方向是少认定肯定线索，不误认。 */
const CJK_NEGATION_WINDOW = 6

/** 英文否定词与中心词之间常隔冠词（without any nda），窗口相应放宽。 */
const LATIN_NEGATION_WINDOW = 24

/**
 * 指示符匹配：中文指示符按子串，拉丁指示符按词边界，不区分肯定与否定。
 * @param snippet - 已小写的待匹配文本。
 * @param keywords - 指示符表。
 * @returns 是否出现任一指示符。
 */
function containsIndicator(snippet: string, keywords: readonly string[]): boolean {
  return keywords.some(kw => indicatorPattern(kw.toLowerCase()).test(snippet))
}

/**
 * 否定感知的指示符匹配：只认定未被否定的命中。片段写「未约定保密义务」时是在
 * 排除保密义务，不能据此认定存在保密义务；写「未在中国境内销售」时也不能认定
 * 使用地在中国境内。
 * @param snippet - 已小写的待匹配文本。
 * @param keywords - 指示符表。
 * @returns 是否存在未被否定的命中。
 */
function containsAffirmed(snippet: string, keywords: readonly string[]): boolean {
  return keywords.some(kw => hasAffirmedOccurrence(snippet, kw.toLowerCase()))
}

/**
 * 单个指示符的匹配式。拉丁指示符按词边界（前导字符在捕获组内，以便还原命中位置），
 * 中文指示符按子串。
 * @param needle - 已小写的指示符。
 * @param flags - 正则标志。
 * @returns 匹配式。
 */
function indicatorPattern(needle: string, flags = ''): RegExp {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return LATIN_INDICATOR_RE.test(needle)
    ? new RegExp(`(^|[^a-z])${escaped}(?=[^a-z]|$)`, flags)
    : new RegExp(escaped, flags)
}

/**
 * 指示符是否存在未被否定的命中。
 * @param snippet - 已小写的待匹配文本。
 * @param needle - 已小写的指示符。
 * @returns 是否命中且未被否定。
 */
function hasAffirmedOccurrence(snippet: string, needle: string): boolean {
  const window = LATIN_INDICATOR_RE.test(needle) ? LATIN_NEGATION_WINDOW : CJK_NEGATION_WINDOW
  for (const match of snippet.matchAll(indicatorPattern(needle, 'g'))) {
    const start = match.index + (match[1]?.length ?? 0)
    if (!isNegatedAt(snippet, start, window)) return true
  }
  return false
}

/**
 * 指示符起始处之前是否带否定标记。
 * @param snippet - 已小写的待匹配文本。
 * @param start - 指示符起始下标。
 * @param window - 向前回看的字符数。
 * @returns 该处是否被否定。
 */
function isNegatedAt(snippet: string, start: number, window: number): boolean {
  const before = snippet.slice(Math.max(0, start - window), start)
  const stripped = NEGATION_EXEMPT.reduce((text, combo) => text.replaceAll(combo, ''), before)
  return NEGATION_MARKERS.some(marker => stripped.includes(marker))
}

/**
 * 使用公开四要件检查（时间/地点/方式/公众可获取性，对齐 Mady evaluateFourElements）。
 * 要件只能由片段中的线索认定：未提及即 `met: false` 并说明缺什么，不推定满足；
 * 被片段否认的线索（如「未在中国境内销售」「未约定保密义务」）同样不按肯定认定。
 * @param span - 证据实体。
 * @returns 四要件检查结果。
 */
export function evaluateFourElements(span: EvidenceSpan): FourElementsResult {
  const timeElement = evaluatePublicUseTime(span)
  const placeElement = evaluatePublicUsePlace(span)
  const methodElement = evaluatePublicUseMethod(span)
  const accessibility = evaluatePublicUseAccessibility(span)
  const allMet = timeElement.met && placeElement.met && methodElement.met && accessibility.met
  return {
    timeElement,
    placeElement,
    methodElement,
    accessibility,
    allMet,
    overallScore: (timeElement.score + placeElement.score + methodElement.score + accessibility.score) / 4,
  }
}

function evaluatePublicUseTime(span: EvidenceSpan): ElementResult {
  if (span.docVersion === undefined || span.docVersion === '') {
    return { met: false, score: 0.25, detail: '未提供使用公开日期，无法判断是否在现有技术截止日之前' }
  }
  if (parseDateFlexible(span.docVersion) === null) {
    return { met: false, score: 0.3, detail: `日期格式无法识别: ${span.docVersion}` }
  }
  if (isPreciseDate(span.docVersion)) {
    return { met: true, score: 0.9, detail: `使用公开日期为 ${span.docVersion}，格式完整` }
  }
  return { met: true, score: 0.7, detail: `使用公开日期为 ${span.docVersion}，精度不足，需补充具体日期` }
}

function evaluatePublicUsePlace(span: EvidenceSpan): ElementResult {
  const snippet = (span.snippet ?? '').toLowerCase()
  const domesticIndicators = ['中国', '北京', '上海', '广州', '深圳', '国内', '境内']
  const foreignIndicators = ['美国', '日本', '德国', '英国', '法国', '韩国', '国外', '境外', 'us', 'usa', 'europe', 'international']
  if (containsAffirmed(snippet, domesticIndicators)) {
    return { met: true, score: 0.85, detail: '使用行为发生在中国境内（构成国内公开）' }
  }
  if (containsAffirmed(snippet, foreignIndicators)) {
    return { met: true, score: 0.8, detail: '使用行为发生在境外（构成国外公开，中国专利法采用绝对新颖性标准）' }
  }
  return { met: false, score: 0.3, detail: '片段未提及使用地点，无法认定公开发生地，需补充使用地点的直接证据' }
}

function evaluatePublicUseMethod(span: EvidenceSpan): ElementResult {
  const snippet = (span.snippet ?? '').toLowerCase()
  const salesIndicators = ['销售', '出售', '售卖', '购买', 'sell', 'sale', 'transaction']
  const exhibitionIndicators = ['展览', '展出', '展示', '演示', 'exhibition', 'expo', 'fair', 'show', 'demonstrat']
  const publicationIndicators = ['出版', '发布', '发表', '公开', 'publish', 'release', 'post']
  const otherIndicators = ['使用', '实施', '制造', '生产', 'use', 'manufactur', 'produc']

  if (containsAffirmed(snippet, salesIndicators)) {
    return { met: true, score: 0.9, detail: '通过销售行为公开使用' }
  }
  if (containsAffirmed(snippet, exhibitionIndicators)) {
    return { met: true, score: 0.85, detail: '通过展览或展示行为公开使用' }
  }
  if (containsAffirmed(snippet, publicationIndicators)) {
    return { met: true, score: 0.75, detail: '通过发布/发表行为公开使用' }
  }
  if (containsAffirmed(snippet, otherIndicators)) {
    return { met: true, score: 0.6, detail: '通过其他方式公开使用，需进一步明确具体方式' }
  }
  return { met: false, score: 0.3, detail: '未识别出明确的使用公开方式，需补充公开方式的描述（如销售、展览、演示等）' }
}

function evaluatePublicUseAccessibility(span: EvidenceSpan): ElementResult {
  const snippet = (span.snippet ?? '').toLowerCase()
  const confidentialityIndicators = ['保密', '秘密', 'confidential', '保密协议', 'nda', 'non-disclosure']
  const limitedAccessIndicators = ['内部', '内测', '内部测试', 'closed', 'internal', 'invite-only']
  const publicAccessIndicators = ['公开', '开放', '公众', 'public', 'open', 'anyone']

  if (containsAffirmed(snippet, confidentialityIndicators)) {
    return { met: false, score: 0.2, detail: '存在保密义务或保密措施，可能不构成公众可获取' }
  }
  if (containsAffirmed(snippet, limitedAccessIndicators)) {
    return { met: false, score: 0.35, detail: '使用行为限于特定范围，非对公众开放' }
  }
  if (containsAffirmed(snippet, publicAccessIndicators)) {
    return { met: true, score: 0.9, detail: '使用行为对公众开放，公众可获取' }
  }
  if (containsIndicator(snippet, confidentialityIndicators)) {
    return {
      met: false,
      score: 0.5,
      detail: '片段说明不存在保密义务，但未说明使用是否对不特定公众开放，公众可获取性要件仍未认定',
    }
  }
  return { met: false, score: 0.3, detail: '片段未提及使用是否对公众开放，无法认定公众可获取，需补充旁证' }
}

/**
 * 举证难度：按四要件满足数分档。要件缺失越多，补证负担越重。
 * @param fourElements - 四要件检查结果。
 * @returns 难度档位。
 */
function assessBurdenDifficulty(fourElements: FourElementsResult | undefined): string {
  /* v8 ignore next -- called only from the public_use branch with a computed FourElementsResult */
  if (fourElements === undefined) return '无法评估'
  const metCount = [
    fourElements.timeElement,
    fourElements.placeElement,
    fourElements.methodElement,
    fourElements.accessibility,
  ].filter(e => e.met).length
  if (metCount >= 4) return '中'
  if (metCount >= 2) return '高'
  return '极高'
}

/**
 * 证据链完整性建议。内容哈希只作锚点陈述：未经独立核验不称"完整"。
 * @param span - 证据实体。
 * @param external - 外部输入（是否已独立核验完整性）。
 * @param fourElements - 四要件检查结果。
 * @returns 证据链完整性表述。
 */
function assessChainIntegrity(
  span: EvidenceSpan,
  external: EvidenceExternalInputs,
  fourElements: FourElementsResult | undefined,
): string {
  /* v8 ignore next -- called only from the public_use branch with a computed FourElementsResult */
  if (fourElements === undefined) return '无法评估'
  if (fourElements.allMet) {
    if (hasText(span.contentHash) && external.integrityVerified === true) {
      return '完整（四要素齐全且内容哈希经独立核验）'
    }
    return '较完整（四要素齐全，建议补充旁证印证）'
  }
  if (hasText(span.snippet)) {
    return '需补充证据（部分要件缺失，建议提供销售合同/展览记录等直接证据）'
  }
  return '证据链不完整，建议收集多份相互印证的证据'
}
