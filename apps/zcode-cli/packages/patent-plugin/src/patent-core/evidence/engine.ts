/**
 * 证据判断引擎（移植自 Mady domains/evidence/engine.go + triple_attrs.go）。
 *
 * 拆分说明（移植规则 7）：源文件 src/evidence/engine.ts 共 958 行，超过单文件
 * 800 行上限；判定辅助函数（三性评分/类型特定判定/使用公开四要件）拆至
 * engine-evaluators.ts，本文件保留规则条件评估（evaluateCondition）与
 * EvidenceEngine 类。公开导出面（inferEvidenceType / evaluateFourElements /
 * STANDARD_*）在本文件再导出，evidence/index.ts 的 re-export 路径不变。
 *
 * 对单条证据做三性判定（相关性/合法性/真实性）+ 类型特定判定（电子证据/
 * 互联网公开/域外/证人/公知常识/使用公开/现有技术日期），综合评分；
 * 并提供举证责任分配与证明标准达成评估。
 *
 * 设计对齐 Mady：确定性判定（无 LLM），权重可经 YAML 资产
 * （rules/patent/evidence-rules.yaml）配置；外部服务不可用时降级而非失败。
 */

import { assertNever } from '../utils.js'
import type { EvidenceSpan } from './span.js'
import { isLocatable } from './span.js'
import { determinePublicationDate, priorArtReference, type PriorArtReference } from './date.js'
import { DEFAULT_WEIGHTS, parseRuleSet } from './rule-set.js'
import {
  evaluateAuthenticity,
  evaluateFourElements,
  evaluateLegality,
  evaluateRelevance,
  evaluateTypeSpecific,
  hasText,
  inferEvidenceType,
} from './engine-evaluators.js'
import type {
  BurdenDetermination,
  DimensionJudgment,
  EvidenceExternalInputs,
  EvidenceJudgment,
  EvidenceJudgmentEngine,
  EvidenceRule,
  EvidenceType,
  FourElementsResult,
  JudgmentIssue,
  PriorArtBasis,
  ProofStandardResult,
  RuleApplication,
} from './types.js'

/** 规则条件评估上下文。 */
type ConditionContext = {
  span: EvidenceSpan
  /** 调用方给出的申请日/优先权日。 */
  basis: PriorArtBasis
  /** 解析出的现有技术截止日（不可解析时为 undefined）。 */
  reference: PriorArtReference | undefined
  external: EvidenceExternalInputs
}

/**
 * 使用公开四要件条件名 → 对应要件的判定。条件名与 `evidence-rules.yaml` 的 EVI-015 一致。
 */
const PUBLIC_USE_CONDITIONS: Record<string, (fourElements: FourElementsResult) => boolean> = {
  public_use_time_available: fourElements => fourElements.timeElement.met,
  public_use_place_identified: fourElements => fourElements.placeElement.met,
  public_use_method_identified: fourElements => fourElements.methodElement.met,
  public_use_publicly_accessible: fourElements => fourElements.accessibility.met,
}

/**
 * 规则条件评估器：已知条件（span/日期可判）返回 true/false；
 * 外部输入条件（公证/译本/证人披露等）未提供时返回 undefined（pending）；
 * 未知条件返回 undefined（不误判）。
 */
function evaluateCondition(name: string, ctx: ConditionContext): boolean | undefined {
  const publicUseCheck = PUBLIC_USE_CONDITIONS[name]
  if (publicUseCheck !== undefined) return publicUseCheck(evaluateFourElements(ctx.span))
  switch (name) {
    case 'evidence_has_claim_refs':
      return (ctx.span.claimRefs?.length ?? 0) > 0
    case 'evidence_direction_clear':
      return ctx.span.direction === 'supporting' || ctx.span.direction === 'contradicting'
    case 'evidence_source_identified':
      return hasText(ctx.span.sourceUri)
    case 'evidence_content_hash_available':
    case 'content_hash_provided':
      return hasText(ctx.span.contentHash)
    case 'evidence_source_uri_or_doc_version_available':
      return hasText(ctx.span.sourceUri) || hasText(ctx.span.docVersion)
    case 'evidence_has_source_uri':
      return hasText(ctx.span.sourceUri)
    case 'publication_date_available':
      // The condition is about an ascertained date, not about a non-empty field:
      // an unparseable page date or a Wayback URL both go through the same
      // determination the judgment reports.
      return determinePublicationDate(ctx.span.docVersion, ctx.span.sourceUri, ctx.reference).determined !== 'unknown'
    case 'prior_art_reference_available':
      return ctx.reference !== undefined
    case 'evidence_notarized':
      return ctx.external.notarized
    case 'evidence_legalized':
      return ctx.external.legalized
    case 'evidence_translated':
      return ctx.external.translated
    case 'evidence_witness_disclosed':
      return ctx.external.witnessDisclosed
    case 'fact_is_well_known':
      return ctx.external.isWellKnown
    case 'fact_is_uncontested':
      return ctx.external.isUncontested
    case 'deadline_defined':
      return ctx.external.deadlineDefined
    case 'submission_within_deadline':
      return ctx.external.submissionWithinDeadline
    // ── EVI-002 证据收集合法性（外部输入；未提供时 pending）──
    case 'evidence_collection_legal':
      return ctx.external.collectionLegal
    // ── EVI-020 举证责任：案件类型已识别（外部输入；未提供时 pending）──
    case 'case_type_identified':
      return typeof ctx.external.caseType === 'string' && ctx.external.caseType.trim().length > 0 ? true : undefined
    // ── EVI-030 证明标准：支持/矛盾证据已计数（外部输入；未提供时 pending）──
    case 'supporting_evidence_counted':
      return typeof ctx.external.supportingCount === 'number' ? true : undefined
    case 'contradicting_evidence_counted':
      return typeof ctx.external.contradictingCount === 'number' ? true : undefined
    // ── EVI-050 证据链：保管链可追溯 / 完整性已核验（外部输入；未提供时 pending）──
    case 'custody_chain_traceable':
      return ctx.external.custodyChainTraceable
    case 'evidence_integrity_verified':
      return ctx.external.integrityVerified
    default:
      return undefined
  }
}

/** 证明标准标识。 */
export const STANDARD_PREPONDERANCE = 'preponderance'
/** 高度盖然性（清晰且令人信服）证明标准标识。 */
export const STANDARD_CLEAR_CONVINCING = 'clear_and_convincing'

// 判定辅助函数（三性评分/类型特定判定/使用公开四要件）拆至 engine-evaluators.ts，
// 这里再导出以保持 evidence/index.ts 与源包一致的公开导出面。
export { inferEvidenceType, evaluateFourElements }

// ---------------------------------------------------------------------------
// DefaultEngine（对齐 Mady DefaultEngine）
// ---------------------------------------------------------------------------

/**
 * 默认证据判断引擎。RuleIndex 内联实现（加载 YAML 资产 → 规则表），
 * 资产缺失时降级为默认权重 + 空规则表（不抛错）。
 */
export class EvidenceEngine implements EvidenceJudgmentEngine {
  private weights = { ...DEFAULT_WEIGHTS }
  private rules: EvidenceRule[] = []
  private readonly warnings: string[] = []

  constructor(yamlText?: string, source = '<inline>') {
    if (yamlText !== undefined) this.loadRules(yamlText, source)
  }

  loadRules(yamlText: string, source = '<inline>'): void {
    const { ruleSet, warnings } = parseRuleSet(yamlText, source)
    this.warnings.push(...warnings)
    if (ruleSet === null) return
    this.weights = { ...ruleSet.weights }
    this.rules = ruleSet.rules
  }

  /**
   * 规则加载期间累积的警告。
   * @returns 警告字符串数组副本。
   */
  getWarnings(): string[] {
    return [...this.warnings]
  }

  getRules(): EvidenceRule[] {
    return [...this.rules]
  }

  getRulesByType(evidenceType: EvidenceType): EvidenceRule[] {
    return this.rules.filter(r => r.evidenceType === evidenceType)
  }

  /**
   * 对单条证据做三性 + 类型特定判定（evidenceType 显式指定时覆盖 URI 推断）。
   * @param span - 证据实体。
   * @param basis - 申请日与优先权日（现有技术截止日取较早者）。
   * @param evidenceType - 显式证据类型，覆盖 URI 推断。
   * @param external - 外部输入（公证/译本/独立核验等）。
   * @returns 该证据的完整判定结果。
   */
  judge(
    span: EvidenceSpan,
    basis: PriorArtBasis = {},
    evidenceType?: EvidenceType,
    external: EvidenceExternalInputs = {},
  ): EvidenceJudgment {
    const evType = evidenceType ?? inferEvidenceType(span)
    const reference = priorArtReference(basis)
    const judgment: EvidenceJudgment = {
      spanId: span.id,
      direction: span.direction,
      confidence: 0.5,
      overallScore: 0.5,
      reasoning: '',
      flaggedIssues: [],
      rulesApplied: [],
    }

    judgment.relevanceJudgment = evaluateRelevance(span)
    judgment.legalityJudgment = evaluateLegality(span)
    judgment.authenticityJudgment = evaluateAuthenticity(span, external)

    // 缺陷提示按证据记录的语义条件判定，不按评分阈值：评分是完备度的连续量，整数阈值
    // 只会随权重调整而静默开关告警通道。
    const issues: JudgmentIssue[] = []
    if ((span.claimRefs?.length ?? 0) === 0) {
      issues.push({
        type: 'relevance',
        description: '证据未绑定任何权利要求或结论（claimRefs 为空），与待证事实的关联性无法确认',
        severity: 'major',
      })
    }
    if (!hasText(span.sourceUri)) {
      issues.push({
        type: 'legality',
        description: '未记录证据来源（sourceUri 为空），取证合法性无法确认',
        severity: 'critical',
      })
    }
    if (!isLocatable(span)) {
      issues.push({
        type: 'authenticity',
        description: '证据不可定位（无来源/版本/页码/字符区间/哈希），真实性无法核验',
        severity: 'critical',
      })
    }
    judgment.flaggedIssues = issues

    judgment.typeSpecificJudgment = evaluateTypeSpecific(span, evType, external, reference)
    judgment.overallScore = this.computeOverallScore(judgment)
    // confidence 与评分关联（低分证据不应宣称"确信"）——固定 1.0 是误导。
    judgment.confidence = Number(judgment.overallScore.toFixed(3))
    judgment.rulesApplied = this.applyRules(span, evType, basis, reference, external)
    judgment.reasoning = this.buildReasoning(judgment, evType)
    return judgment
  }

  /**
   * 批量判定（同一时间基准与外部输入下的多条证据）。
   * @param spans - 证据实体列表。
   * @param basis - 申请日与优先权日。
   * @param evidenceType - 显式证据类型。
   * @param external - 外部输入。
   * @returns 逐条判定结果。
   */
  batchJudge(
    spans: EvidenceSpan[],
    basis: PriorArtBasis = {},
    evidenceType?: EvidenceType,
    external?: EvidenceExternalInputs,
  ): EvidenceJudgment[] {
    return spans.map(span => this.judge(span, basis, evidenceType, external))
  }

  /**
   * 规则表应用（evidence-rules.yaml）：每条匹配证据类型的规则，对其 check.conditions
   * 逐项评估——已知条件（span/日期可判）确定 true/false；外部输入条件（公证/译本等）
   * 未提供时标记 pending（不误判为失败）。满足全部条件的规则为实际适用（rulesMatched）。
   * @param span - 证据实体。
   * @param evType - 证据类型。
   * @param basis - 申请日与优先权日。
   * @param reference - 解析出的现有技术截止日。
   * @param external - 外部输入。
   * @returns 每条候选规则的适用结果。
   */
  private applyRules(
    span: EvidenceSpan,
    evType: EvidenceType,
    basis: PriorArtBasis,
    reference: PriorArtReference | undefined,
    external: EvidenceExternalInputs,
  ): RuleApplication[] {
    const ctx: ConditionContext = { span, basis, reference, external }
    const applicable = this.rules.filter(r => r.evidenceType === evType || r.evidenceType === 'general')
    return applicable.map((rule) => {
      const conditions = rule.check?.conditions ?? []
      const pendingInputs: string[] = []
      const failedConditions: string[] = []
      let allMet = true
      for (const condition of conditions) {
        const result = evaluateCondition(condition, ctx)
        if (result === undefined) {
          pendingInputs.push(condition)
        } else if (!result) {
          allMet = false
          failedConditions.push(condition)
        }
      }
      return {
        ruleId: rule.ruleId,
        name: rule.name,
        action: rule.action,
        severity: rule.severity,
        // 有 pending 条件的规则不算实际适用（需外部输入确认后才 satisfied）
        satisfied: allMet && pendingInputs.length === 0,
        pendingInputs,
        failedConditions,
      }
    })
  }

  /** 举证责任分配（caseType: invalidation / infringement / new_product_method 等）。 */
  assessBurdenOfProof(caseType: string, context?: Record<string, string>): BurdenDetermination {
    const det: BurdenDetermination = {
      burdenHolder: 'claimant',
      standard: STANDARD_PREPONDERANCE,
      hasShifted: false,
      reasoning: '适用谁主张谁举证原则',
    }
    switch (caseType.toLowerCase()) {
      case 'invalidation':
      case 'invalidity':
      case '无效':
        det.burdenHolder = 'claimant'
        det.reasoning = '无效宣告程序中，请求人对其主张承担举证责任'
        break
      case 'infringement':
      case '侵权':
        det.burdenHolder = 'claimant'
        det.standard = STANDARD_CLEAR_CONVINCING
        det.reasoning = '侵权诉讼中，权利人对其主张承担举证责任'
        break
      case 'new_product_method':
      case '新产品制造方法':
        det.burdenHolder = 'claimant'
        det.hasShifted = true
        det.shiftReason = '新产品制造方法举证责任倒置'
        det.reasoning =
          '权利人须先证明：1) 产品为新产品；2) 被诉产品与依专利方法制造的产品为同样产品。证明后举证责任转移至被诉侵权人'
        break
      default:
        det.burdenHolder = 'claimant'
        det.reasoning = '适用谁主张谁举证原则'
        break
    }
    if (context?.burden_holder !== undefined) det.burdenHolder = context.burden_holder
    return det
  }

  /**
   * 证明标准达成评估（查找表驱动）：
   *   preponderance/优势证据：支持 > 矛盾 且 置信度 ≥ 0.5
   *   clear_and_convincing/高度盖然性：置信度 ≥ 0.7 且 支持 > 2×矛盾
   *   未知标准：置信度 ≥ 0.5（宽松放行）
   * 支持/矛盾按证据的 `direction` 归类，不按评分：立场是当事人主张问题，评分是证明力
   * 问题，高分矛盾证据不是支持证据。neutral 证据不计入比较。置信度取全部证据评分的均值。
   * @param judgments - 待评价的证据判定结果。
   * @param standard - 证明标准标识或中文名。
   * @returns 达成评估结果。
   */
  assessProofStandard(judgments: EvidenceJudgment[], standard: string): ProofStandardResult {
    const result: ProofStandardResult = {
      met: false,
      standard,
      confidence: 0,
      supportingCount: 0,
      contradictingCount: 0,
      neutralCount: 0,
      reasoning: '',
      gaps: [],
    }
    let totalScore = 0
    let validCount = 0
    let supporting = 0
    let contradicting = 0
    let neutral = 0
    for (const j of judgments) {
      validCount += 1
      totalScore += j.overallScore
      switch (j.direction) {
        case 'supporting':
          supporting += 1
          break
        case 'contradicting':
          contradicting += 1
          break
        case 'neutral':
          neutral += 1
          break
        /* v8 ignore next -- closed-union backstop; the compiler rejects a new direction here. */
        default:
          assertNever(j.direction, 'evidence direction')
      }
    }
    result.supportingCount = supporting
    result.contradictingCount = contradicting
    result.neutralCount = neutral
    if (validCount > 0) result.confidence = totalScore / validCount

    const STANDARDS: Record<string, { minConfidence: number; ratio: 'preponderance' | 'clear_convincing' }> = {
      [STANDARD_PREPONDERANCE]: { minConfidence: 0.5, ratio: 'preponderance' },
      优势证据: { minConfidence: 0.5, ratio: 'preponderance' },
      [STANDARD_CLEAR_CONVINCING]: { minConfidence: 0.7, ratio: 'clear_convincing' },
      高度盖然性: { minConfidence: 0.7, ratio: 'clear_convincing' },
    }
    const rule = STANDARDS[standard]
    if (rule !== undefined) {
      result.met =
        rule.ratio === 'preponderance'
          ? supporting > contradicting && result.confidence >= rule.minConfidence
          : result.confidence >= rule.minConfidence && supporting > contradicting * 2
    } else {
      result.met = result.confidence >= 0.5
    }
    if (contradicting > 0) {
      result.gaps.push(`存在 ${contradicting} 件反证，需逐件评价证明力后再认定`)
    }
    if (validCount === 0) {
      result.gaps.push('无证据支持')
      result.met = false
    }
    result.reasoning =
      `支持证据 ${supporting} 件 / 反证 ${contradicting} 件 / 中性 ${neutral} 件，平均置信度 ${(result.confidence * 100).toFixed(0)}%`
    return result
  }

  /** 综合三性评分（权重可经 YAML 配置）；电子/互联网公开类按平台可信度修正。 */
  private computeOverallScore(judgment: EvidenceJudgment): number {
    const dims: Array<DimensionJudgment | undefined> = [
      judgment.relevanceJudgment,
      judgment.legalityJudgment,
      judgment.authenticityJudgment,
    ]
    const weights = [this.weights.relevance, this.weights.legality, this.weights.authenticity]
    let total = 0
    let weightSum = 0
    dims.forEach((d, i) => {
      const weight = weights[i]
      /* v8 ignore next -- judge() always sets all three dimension judgments and weights are numbers */
      if (d !== undefined && weight !== undefined) {
        total += d.score * weight
        weightSum += weight
      }
    })
    if (weightSum === 0) return 0.5
    let base = total / weightSum

    const ts = judgment.typeSpecificJudgment
    if (ts?.credibilityScore !== undefined) {
      const modifier = 0.9 + 0.2 * ts.credibilityScore
      base *= modifier
    }
    // 0-1 评分契约：可信度修正可能使综合分超过 1.0（官方平台 0.95 → 修正 1.09），必须截断
    return Math.min(1, base)
  }

  private buildReasoning(judgment: EvidenceJudgment, evType: EvidenceType): string {
    const parts: string[] = []
    /* v8 ignore next 2 -- judge() always sets the relevance judgment */
    if (judgment.relevanceJudgment !== undefined) {
      parts.push(`关联性[${judgment.relevanceJudgment.level}]: ${judgment.relevanceJudgment.reasoning}`)
    }
    /* v8 ignore next 2 -- judge() always sets the legality judgment */
    if (judgment.legalityJudgment !== undefined) {
      parts.push(`合法性[${judgment.legalityJudgment.level}]: ${judgment.legalityJudgment.reasoning}`)
    }
    /* v8 ignore next 2 -- judge() always sets the authenticity judgment */
    if (judgment.authenticityJudgment !== undefined) {
      parts.push(`真实性[${judgment.authenticityJudgment.level}]: ${judgment.authenticityJudgment.reasoning}`)
    }
    const ts = judgment.typeSpecificJudgment
    /* v8 ignore next -- judge() always sets the type-specific judgment */
    if (ts !== undefined) {
      switch (evType) {
        case 'internet_publication': {
          const dd = ts.dateDetermination
          /* v8 ignore next -- internet_publication always carries a date determination */
          const dateStr = dd !== undefined ? `${dd.determined}(${dd.reliability}/${dd.sourceType})` : '未知'
          /* v8 ignore next -- internet_publication always sets platform credibility, integrity and intent */
          parts.push(
            `类型检查[互联网公开]: 日期=${dateStr}, 可信度=${ts.platformCredibility ?? '未知'}(${(ts.credibilityScore ?? 0).toFixed(2)}), 完整性=${ts.contentIntegrity ?? '未知'}, 意图=${ts.publicIntent ?? '未知'}`,
          )
          break
        }
        case 'electronic':
          /* v8 ignore next -- electronic always sets platform credibility and score */
          parts.push(
            `类型检查[电子证据]: 可信度=${ts.platformCredibility ?? '未知'}(${(ts.credibilityScore ?? 0).toFixed(2)})`,
          )
          break
        case 'public_use': {
          const fe = ts.fourElementsCheck
          /* v8 ignore next -- public_use always sets fourElements, burden difficulty and chain integrity */
          parts.push(
            `类型检查[使用公开]: 四要件=${fe === undefined ? '未评估' : fe.allMet ? '全部满足' : '未全部满足'}, 举证难度=${ts.burdenDifficulty ?? '未知'}, 证据链=${ts.chainIntegrity ?? '未知'}`,
          )
          break
        }
        case 'common_knowledge':
          parts.push(`类型检查[公知常识]: ${ts.exemptionApplied ?? '已完成'}`)
          break
        default:
          parts.push(`类型检查[${evType}]: 已完成`)
          break
      }
    }
    /* v8 ignore next -- the three dimension judgments above always populate parts */
    return parts.length === 0 ? '未执行评估' : parts.join('; ')
  }
}
