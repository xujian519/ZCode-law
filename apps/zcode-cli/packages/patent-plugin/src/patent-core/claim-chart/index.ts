export * from './protocol/types.js'
export {
  normalizeWhitespace,
  validateElements,
  splitClaimSegments,
  type ElementValidationResult,
} from './runtime/element-validator.js'
export {
  validateRowMapping,
  deriveNoveltyCoverage,
  deriveNoveltyCoverageByClaim,
  deriveDistinguishingFeatures,
  isElementCovered,
  type ClaimNoveltyCoverage,
} from './runtime/mapping-machine.js'
export {
  deriveClaimRefs,
  validateClaimRefs,
  referencedClosure,
  parseReferenceNumbers,
  type ClaimRefIssue,
} from './runtime/claim-refs.js'
export {
  deriveInvalidityConclusion,
  renderInvalidityConclusion,
  type DependentClaimPathIssue,
  type InvalidityConclusion,
  type InvalidityConclusionInput,
} from './runtime/invalidity-conclusion.js'
export { detectGaps } from './runtime/gap-detector.js'
export {
  validatePinCite,
  verifyQuoteInSource,
  type PinCiteCheckResult,
} from './runtime/pin-cite-validator.js'
export {
  saveClaimChart,
  loadClaimChart,
  renderChartMarkdown,
  chartFileBase,
} from './runtime/store.js'
