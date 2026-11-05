/**
 * patent-server 对外契约：调用方要想正确调用就必须知道的一切都写在这里；其余对外不可见。
 *
 * v1（Phase 3 groundwork）只承诺一件事：进程内存在一个确定性的 MCP 工具注册表，
 * server.ts 负责把它装配成 MCP `Tool[]` 并处理 stdio 生命周期。
 * 后续阶段（rule_check / law_search 等约 60 个工具）只向注册表追加定义，
 * 每个工具一个文件放在 `src/server/tools/<name>.ts`，不改动本契约的既有形状。
 */
import { z } from "zod";

/** MCP server 实现名称（initialize 时上报，与 plugin.json mcpServers 键一致）。 */
export const PATENT_SERVER_NAME = "patent";
/** server 版本：与包版本保持一致递增（plugin.json / package.json）。 */
export const PATENT_SERVER_VERSION = "0.1.0";
/** 工具可见域标识：patent_status 返回的 domain 字段。 */
export const PATENT_DOMAIN_ID = "patent";

/**
 * 统一请求上下文（所有工具共享的约定）：host client 经 MCP `_meta` 的
 * `com.zcode/request-context` 命名空间传入，passthrough 保留扩展字段。
 * 顶层 MCP `_meta` 是第三方可扩展字段，不能成为 ZCode session 路由凭据，
 * 与 node-repl-host 同款的 fail-closed 解析：解析失败按空上下文处理，不抛错。
 */
export const requestContextSchema = z
  .object({
    parent_span_id: z.string().optional(),
    runtime_scope: z.enum(["main", "subagent"]).default("main"),
    session_id: z.string().trim().min(1).optional(),
    span_id: z.string().optional(),
    trace_id: z.string().optional(),
    turn_id: z.string().optional(),
    workspace_identity: z.string().optional(),
    workspace_key: z.string().optional(),
    workspace_path: z.string().optional(),
    remote_session_id: z.string().optional(),
  })
  .passthrough();

export type PatentRequestContext = z.infer<typeof requestContextSchema>;

/** host client 写入请求上下文的 `_meta` 命名空间键。 */
export const REQUEST_CONTEXT_META_KEY = "com.zcode/request-context";

/** 结构化错误码：工具 handler 返回（一等错误对象），server 层归一化为 MCP isError。 */
export const PATENT_TOOL_ERROR_CODES = {
  /** 工具内部预期外失败（确定性工具原则上不应产出）。 */
  internal: "internal_error",
  /** 工具自身判定输入不可处理（区别于 MCP 层 INVALID_PARAMS 的参数形状错误）。 */
  invalidInput: "invalid_input",
} as const;

export type PatentToolErrorCode =
  (typeof PATENT_TOOL_ERROR_CODES)[keyof typeof PATENT_TOOL_ERROR_CODES];

/** 工具级结构化错误：handler 返回它而不是把异常抛到进程顶层。 */
export interface PatentToolError {
  code: PatentToolErrorCode;
  message: string;
  /** 可选补充上下文（必须可 JSON 序列化，不得包含凭据）。 */
  details?: Record<string, unknown>;
}

export type PatentToolResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: PatentToolError };

/** handler 收到的执行上下文；v1 只透传请求上下文，不强制消费。 */
export interface PatentToolHandlerContext {
  requestContext: PatentRequestContext;
  signal: AbortSignal;
}

/**
 * 工具定义：注册表的唯一元素形状。`inputSchema` 用 zod 定义，
 * 装配 MCP `Tool[]` 时统一转 JSON Schema（见 tool-registry.ts）。
 */
export interface PatentToolDefinition<TInput = unknown, TData = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  // 方法简写保持参数双变：具体工具（如 Record<string, never> 入参）可赋给默认 unknown 形参的注册表元素。
  handler(
    input: TInput,
    context: PatentToolHandlerContext,
  ): Promise<PatentToolResult<TData>>;
}
