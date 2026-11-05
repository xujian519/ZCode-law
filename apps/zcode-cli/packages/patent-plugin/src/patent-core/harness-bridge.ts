/**
 * harness-bridge.ts —— DSH harness 词汇桥接（P2.1）。
 *
 * 文件头说明（移植规则）：patent-core 的 model-port 适配器与类型定义消费
 * DSH harness 的 LLM 词汇（@deepseek-ai/dsh-llm 的 ContentBlock / Message /
 * GenerateOptions / StreamChunk / createUserMessage / createAssistantMessage 等）
 * 与 attachment 词汇（@deepseek-ai/dsh-attachment 的 ImageAttachmentRef /
 * AttachmentId）。本文件镜像这些词汇的最小结构类型与构造函数，以保持
 * model-port 适配器行为与 DSH 侧一致（逐调用 temperature 透传、signal 透传、
 * system 折叠、finish 失败重抛等）。ImageAttachmentRef 字段完整照抄
 * DSH packages/attachment/attachment/lib/types/types.d.ts 的定义（含注释）。
 *
 * 语义反转边界（docs/patent-domain/tools.md「LLM 语义反转」）：ZCode 侧工具
 * 不内部调 LLM；本桥接仅供类型兼容与未来注入（fail-loud 桩 / 测试端口），
 * 不接线任何真实 LLM 运行时。
 *
 * 与 DSH 原实现的差异（均为有意的最小化，不影响本模块消费语义）：
 * - 消息构造函数不做 deepFreeze/structuredClone（ZCode 侧无该不可变约束）；
 * - 品牌 id 以本地 unique symbol 声明，结构与 dsh-brand 等价；
 * - 不镜像 Message 的 developer/tool 角色（patent-core 只构造 user/assistant），
 *   但 ContentBlock/StreamChunk 联合按 DSH 原样保留全部成员以维持穷尽 switch 行为。
 */

import { randomUUID } from 'node:crypto'

const BRAND: unique symbol = Symbol('patent-core.harness-bridge.brand')
type Branded<B extends string> = string & { readonly [BRAND]: B }

/** 会话内消息稳定 id。 */
export type MessageId = Branded<'MessageId'>
/** 工具调用 id（供应商签发）。 */
export type ToolCallId = Branded<'ToolCallId'>
/** 供应商签发的请求诊断 id。 */
export type ProviderRequestId = Branded<'ProviderRequestId'>
/** 适配器私有推理强度选项 id。 */
export type ReasoningEffortId = Branded<'ReasoningEffortId'>
/** 会话身份标识（回放按键）。 */
export type SessionId = Branded<'SessionId'>

/** 附件 id 品牌函数：把后端给出的不透明标识打上品牌。 */
function branded<B extends string>(value: string): Branded<B> {
  return value as Branded<B>
}

// ---------------------------------------------------------------------------
// Attachment 词汇（字段与注释照抄 DSH attachment/lib/types/types.d.ts）
// ---------------------------------------------------------------------------

/** Raster image formats accepted by the version-one attachment path. */
export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

/** Durable, serializable reference to one immutable normalized image. */
export interface ImageAttachmentRef {
  /** Opaque storage identifier; never a filesystem path or bearer URL. */
  attachmentId: AttachmentId
  /** Media type verified from the stored bytes. */
  mediaType: ImageMediaType
  /** Exact encoded byte length. */
  bytes: number
  /** Intrinsic encoded width in pixels. */
  width: number
  /** Intrinsic encoded height in pixels. */
  height: number
  /** Optional display name stripped of local path information. */
  name?: string
  /**
   * Input dimensions after applying EXIF orientation and before normalization
   * scaling. Present only when normalization reduced the image.
   */
  originalDimensions?: {
    width: number
    height: number
  }
}

/** Opaque content-addressed identifier for one immutable attachment object. */
export type AttachmentId = Branded<'AttachmentId'>
/**
 * Brand a validated storage identifier.
 * @param value - backend-produced opaque identifier.
 * @returns the branded identifier.
 */
export function AttachmentId(value: string): AttachmentId {
  return branded<'AttachmentId'>(value)
}

// ---------------------------------------------------------------------------
// LLM 消息词汇（镜像 DSH llm/src/types.ts + message.ts）
// ---------------------------------------------------------------------------

/** Serializable provider or transport failure facts; policy decides whether they are retryable. */
export interface LlmFailure {
  /** Human-readable provider or transport failure. */
  readonly message: string
  /** Stable provider-neutral machine-routing code. */
  readonly code: string
  /** HTTP status returned by the provider, when available. */
  readonly status?: number
  /** Provider-requested delay in milliseconds, when valid and available. */
  readonly providerRetryAfterMs?: number
  /** Opaque provider-issued request identifier for diagnostics. */
  readonly requestId?: ProviderRequestId
  /**
   * Single-line diagnostic naming the coded platform error behind a `code` too
   * coarse to act on — for example the socket error a `TRANSPORT` failure
   * otherwise hides. Present only when a coded cause was found, never empty;
   * display-only, and retry and routing policy never read it.
   */
  readonly diagnostic?: string
  /**
   * With code `IMAGE_OFFLOAD_REQUIRED`: how many more of the oldest retained
   * image occurrences the route needs offloaded before the same request fits
   * its exact byte accounting.
   */
  readonly offloadImages?: number
}

/** Plain text visible to the end user. */
export interface TextBlock {
  type: 'text'
  text: string
}

/** Reasoning / thinking content, distinct from visible text. */
export interface ReasoningBlock {
  type: 'reasoning'
  text: string
}

/**
 * A durable raster image reference, valid in user or assistant content. The
 * block is deliberately role-neutral; assistant-side rendering is forward
 * compatibility — the current production adapters declare text-only output,
 * so only user messages may carry images.
 */
export interface ImageBlock {
  type: 'image'
  /** Immutable bytes and intrinsic display metadata owned by the attachment service. */
  attachment: ImageAttachmentRef
  /**
   * Derived from a durable image-offload decision or preserved by a message
   * rewrite. Every route sends placeholder text naming the image and its
   * available read-only path instead of image bytes.
   */
  offloaded?: true
}

/** A tool invocation requested by the model. */
export interface ToolCallBlock {
  type: 'tool-call'
  /** Provider-issued call id; correlates with the matching tool result. */
  id: ToolCallId
  name: string
  /** Raw JSON string as produced by the model. */
  arguments: string
}

/**
 * Merge-extensible content blocks keyed by `type`. New core blocks must land
 * with adapter, UI, and compaction support. Tool-change blocks belong to
 * developer messages; `projectToolUpdates` selects what each route receives.
 */
export interface ContentBlockMap {
  'text': TextBlock
  'reasoning': ReasoningBlock
  'image': ImageBlock
  'tool-call': ToolCallBlock
}

/** The block `type` tag vocabulary; widens as plugins add entries to {@link ContentBlockMap}. */
export type ContentBlockType = keyof ContentBlockMap
/** Any known content block, derived from {@link ContentBlockMap}; switch on `type` and fall through unknowns (merge-extensible). */
export type ContentBlock = ContentBlockMap[ContentBlockType]

/** Provider/model identity and adapter-private replay data for an assistant message. */
export interface AssistantProviderMetadata {
  /** Provider route that produced the message. */
  provider: string
  /** Provider model id that produced the message. */
  model: string
  /**
   * Lossless-JSON adapter state needed to replay the provider response.
   * `LlmRuntime` exposes it to a target adapter only when that adapter instance
   * currently owns both this historical provider and the target provider.
   */
  replayState?: unknown
}

/** Required source of an assistant message produced by a routed model. */
export interface ModelMessageSource extends AssistantProviderMetadata {
  kind: 'model'
}

/** Required source of a system-role message produced by the system-prompt plugin. */
export interface SystemPromptMessageSource {
  kind: 'system-prompt'
}

/**
 * Where a message (or injected content) came from, in the harness's own
 * vocabulary. Merge-extensible sum type — each producer declares its own
 * `kind` in its own module; there is no shared catch-all `plugin` kind.
 * Model and tool sources answer their role messages; user messages carry any
 * producer's kind, and consumers fall through unknown kinds.
 */
export interface MessageSourceMap {
  user: { kind: 'user' }
  model: ModelMessageSource
  'system-prompt': SystemPromptMessageSource
}

/** Any known message source, derived from {@link MessageSourceMap}; switch on `kind` and fall through unknowns (merge-extensible). */
export type MessageSource = MessageSourceMap[keyof MessageSourceMap]

/** Shared immutable fields of every conversation message. */
interface MessageBase {
  /** Stable identity preserved across every representation boundary. */
  readonly id: MessageId
  /** Exact model-facing blocks. */
  readonly content: readonly ContentBlock[]
  /** Required source fields supplied by the producer. */
  readonly source: MessageSource
}

/** A rendered system prompt attributed to the system-prompt producer; empty content sends no prompt. */
export interface SystemMessage extends MessageBase {
  readonly role: 'system'
  readonly source: MessageSourceMap['system-prompt']
}

/** A user-role specialization of the shared message representation. */
export interface UserMessage extends MessageBase {
  readonly role: 'user'
}

/** A model-produced assistant specialization of the shared message representation. */
export interface AssistantMessage extends MessageBase {
  readonly role: 'assistant'
  readonly source: ModelMessageSource
}

/**
 * The conversation messages persisted by Session, keyed by role. This map is
 * closed because every model-visible role must have a durable Session event
 * and an adapter projection.
 */
export interface MessageRoleMap {
  system: SystemMessage
  user: UserMessage
  assistant: AssistantMessage
}

/** Any persisted conversation message, discriminated by its `role`. */
export type Message = MessageRoleMap[keyof MessageRoleMap]

type NewMessage = {
  [Role in keyof MessageRoleMap]: Omit<MessageRoleMap[Role], 'id'>
}[keyof MessageRoleMap]
type NewUserMessage = Omit<UserMessage, 'id' | 'role'>
type NewAssistantMessage = Omit<AssistantMessage, 'id' | 'role' | 'source'> & {
  readonly source: Omit<ModelMessageSource, 'kind'> & { readonly kind?: never }
}

/**
 * Create one identified message. Minimal equivalent of DSH createMessage:
 * assigns a fresh stable id; no deepFreeze/structuredClone (ZCode 侧无该约束)。
 */
function createMessage<T extends NewMessage>(
  input: T & { readonly id?: never },
): T & Pick<Message, 'id'> {
  return {
    ...input,
    id: branded<'MessageId'>(randomUUID()),
  }
}

/**
 * Create one identified user-role message.
 * @param input - complete content and source for a new user message.
 * @returns a user message with a fresh stable identity.
 */
export function createUserMessage<T extends NewUserMessage>(
  input: T & { readonly id?: never; readonly role?: never },
): T & Pick<UserMessage, 'id' | 'role'> {
  return createMessage({
    ...input,
    role: 'user',
  })
}

/**
 * Create one identified model-produced assistant message with fixed role/source tags.
 * @param input - complete content plus the provider and model for a new assistant message.
 * @returns an assistant message with a fresh stable identity.
 */
export function createAssistantMessage(
  input: NewAssistantMessage & { readonly id?: never; readonly role?: never },
): AssistantMessage {
  return createMessage({
    role: 'assistant',
    content: input.content,
    source: {
      kind: 'model',
      ...input.source,
    },
  })
}

// ---------------------------------------------------------------------------
// LLM 请求/流词汇（镜像 DSH llm/src/types.ts）
// ---------------------------------------------------------------------------

/**
 * Why a model response stopped.
 * Merge-extensible so adapters can surface provider-specific reasons.
 */
export interface FinishReasonMap {
  'stop': { kind: 'stop' }
  'max-tokens': { kind: 'max-tokens' }
  'aborted': { kind: 'aborted'; failure: LlmFailure }
  'error': { kind: 'error'; failure: LlmFailure }
}

/** Any known finish reason, derived from {@link FinishReasonMap}; switch on `kind` and fall through unknowns (merge-extensible). */
export type FinishReason = FinishReasonMap[keyof FinishReasonMap]

/**
 * Token accounting for one model call (cache fields are optional).
 *
 * Counts are DISJOINT: `inputTokens` is uncached input only; cached input is
 * reported separately as `cacheReadTokens`/`cacheWriteTokens` (billed input =
 * sum of the three). Adapters whose providers fold cache hits into a total
 * prompt count (DeepSeek's `prompt_tokens`) subtract them out.
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  /**
   * Exact full-call total including aggregate prompt and output tokens.
   *
   * Adapters preserve a provider total or derive it from authoritative
   * aggregate prompt/output counters; they omit it when unavailable or
   * inconsistent.
   */
  totalTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
}

/**
 * Adapter-private lossless-JSON state for replaying a successful response,
 * carried by a terminal `finish` chunk and stored on the assembled assistant
 * message's model source. Both halves stay opaque to the harness; only the
 * split is shared vocabulary, so assembly can keep stored metadata aligned
 * with stored content without reading either half.
 */
export interface ReplayEnvelope {
  /** Response-level adapter-private metadata (ids, native stop reason). */
  response: unknown
  /**
   * Per-block adapter-private metadata, one entry per emitted block in
   * first-seen stream order. When assembly drops a block it drops the entry at
   * the same position; entries whose length does not match the emitted block
   * count discard the whole envelope. An adapter whose metadata is independent
   * of block structure omits this field and the envelope passes through
   * assembly unchanged.
   */
  blocks?: readonly unknown[]
}

/**
 * Raw streaming protocol emitted by adapters.
 * Block indexes correlate interleaved deltas, and `block-end` carries the
 * assembled block. Adapters emit usage before the terminal finish and nothing
 * afterward; tool arguments remain raw JSON strings. An adapter implementation
 * may throw, but `LlmRuntime.stream()` normalizes that failure to a terminal
 * `error` or `aborted` finish before exposing it to consumers.
 */
export type StreamChunk =
  | { type: 'block-start'; index: number; blockType: ContentBlockType }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: ToolCallId; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: ContentBlock }
  | { type: 'usage'; usage: TokenUsage }
  | {
    type: 'finish'
    reason: FinishReason
    /** Replay metadata for a successful response; see {@link ReplayEnvelope}. */
    replayState?: ReplayEnvelope
  }

/**
 * The JSON-schema description of a tool, as sent to the model.
 * Declared here because it is part of {@link GenerateOptions}.
 */
export interface ToolSchema {
  /**
   * Requests deferred loading of the tool definition into model context,
   * independently of whether a tool-addition block records the tool.
   * Uses Anthropic's defer_loading terminology.
   */
  deferLoading?: true
  name: string
  description: string
  /** JSON Schema object for the arguments. */
  parameters: Record<string, unknown>
}

/** User input for one LLM request; it has no durable Session identity or source. */
export interface RequestUserInput {
  readonly role: 'user'
  readonly content: UserMessage['content']
  readonly id?: never
  readonly source?: never
}

/** A durable conversation message or a user input used only for one request. */
export type RequestMessage = Message | RequestUserInput

/** A single model request, fully assembled. */
export interface GenerateOptions {
  /** Registered provider route selecting the adapter instance. */
  provider: string
  model: string
  /** Adapter-owned reasoning effort selected for this exact model. */
  reasoningEffort?: ReasoningEffortId
  /**
   * Ordered conversation messages, exactly as the provider sees them. A
   * loop-built request passes the derived history, whose leading system-role
   * message carries the system prompt; a hand-built one-shot may include
   * identity-free user inputs.
   */
  messages: RequestMessage[]
  /**
   * System prompt text for one-shot callers; adapters map it to the provider's
   * system slot ahead of `messages`. Loop-built requests leave it undefined.
   */
  system?: string
  /** Tool schemas (adapters map to the provider's `tools` field). */
  tools?: ToolSchema[]
  temperature?: number
  maxTokens?: number
  /**
   * Stop sequences: generation halts as soon as the model produces any one of
   * these strings (adapters map to the provider's stop field, e.g. OpenAI
   * `stop`). The stop string itself is not included in the output.
   */
  stop?: string[]
  signal?: AbortSignal
  /**
   * Session identity stamped by the loop for request routing. Replay uses it
   * to separate cursors; adapters may map it to model-hidden transport metadata.
   */
  sessionId?: SessionId
  /**
   * Provider-neutral classification for an auxiliary model call. Adapters may
   * map the purpose to model-hidden transport metadata. Ordinary conversation
   * requests leave it unset.
   */
  purpose?: 'compaction' | 'session-title'
}
