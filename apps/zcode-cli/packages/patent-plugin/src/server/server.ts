/**
 * patent MCP server 入口：从 tool-registry 装配 MCP 工具面，处理 stdio 生命周期。
 * 进程内嵌入（测试）与 stdio 子进程（生产）共用 createPatentMcpServer；
 * 直跑检测保证 import 本文件不会产生副作用。
 */
import { isMainThread } from "node:worker_threads";
import { INVALID_PARAMS, Server, type CallToolResult, type Tool } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import {
  PATENT_SERVER_NAME,
  PATENT_SERVER_VERSION,
  REQUEST_CONTEXT_META_KEY,
  requestContextSchema,
  type PatentRequestContext,
  type PatentToolDefinition,
} from "./contract.js";
import {
  installPatentProcessGuards,
  installPatentShutdownTriggers,
  isDirectMcpEntrypoint,
} from "./process-lifecycle.js";
import { getPatentTool, toMcpPatentTools } from "./tool-registry.js";

export const PATENT_MCP_PROCESS_TITLE = "zcode-patent-mcp";

export const PATENT_SERVER_INSTRUCTIONS =
  "专利域 MCP server：提供专利检索、分析、撰写、答复、期限费用与案件管理工具。" +
  "v1 仅有 patent_status 能力探针；后续工具随版本逐项开放。";

export interface PatentMcpRuntime {
  server: Server;
  /** 入口层捕获的插件根目录；v1 只持有引用，供后续阶段定位索引资产/案件目录。 */
  pluginRoot: string | undefined;
  dispose(): void;
}

/**
 * 构建 patent MCP server 运行时。`pluginRoot` 由入口层从 ZCODE_PLUGIN_ROOT 捕获，
 * v1 只持有引用（供后续阶段的索引资产/案件目录定位使用），不做文件 IO。
 */
export function createPatentMcpServer(
  input: { pluginRoot?: string } = {},
): PatentMcpRuntime {
  const server = new Server(
    { name: PATENT_SERVER_NAME, version: PATENT_SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: PATENT_SERVER_INSTRUCTIONS },
  );
  let disposed = false;

  server.setRequestHandler("tools/list", async () => ({ tools: toMcpPatentTools() }));
  server.setRequestHandler("tools/call", async (request, extra) => {
    if (disposed) throw new Error("patent MCP server is disposed");
    const name = request.params.name;
    const tool = getPatentTool(name);
    if (!tool) invalidParams(`Tool ${name} not found`);
    const parsedInput = tool.inputSchema.safeParse(request.params.arguments ?? {});
    if (!parsedInput.success) {
      const issue = parsedInput.error.issues[0];
      invalidParams(`${name}: ${issue?.message ?? "invalid arguments"}`);
    }
    const requestContext = buildRequestContext(extra.mcpReq._meta);
    const result = await runToolHandler(tool, parsedInput.data, requestContext, extra.mcpReq.signal);
    return result;
  });

  return {
    server,
    pluginRoot: input.pluginRoot,
    dispose: () => {
      disposed = true;
    },
  };
}

/** handler 约定返回结构化结果；这里把异常兜底成 internal_error，绝不让它抛穿到协议层。 */
async function runToolHandler(
  tool: PatentToolDefinition,
  input: unknown,
  requestContext: PatentRequestContext,
  signal: AbortSignal,
): Promise<CallToolResult> {
  try {
    const result = await tool.handler(input, { requestContext, signal });
    if (!result.ok) {
      return toErrorResult({ error: result.error });
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data) }],
    };
  } catch (error) {
    return toErrorResult({
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

function toErrorResult(payload: { error: { code: string; message: string } }): CallToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    isError: true,
  };
}

/** 顶层 MCP `_meta` 是第三方可扩展字段，不能成为 ZCode session 路由凭据（fail-closed）。 */
function buildRequestContext(meta: Record<string, unknown> | undefined): PatentRequestContext {
  const parsed = requestContextSchema.safeParse(meta?.[REQUEST_CONTEXT_META_KEY]);
  return parsed.success ? parsed.data : { runtime_scope: "main" };
}

function invalidParams(message: string): never {
  throw Object.assign(new Error(message), { code: INVALID_PARAMS });
}

export function setPatentMcpProcessTitle(target: { title: string } = process): void {
  target.title = PATENT_MCP_PROCESS_TITLE;
}

export async function main(): Promise<void> {
  setPatentMcpProcessTitle();
  // 入口层允许读取 env：plugin host 在 MCP initialize 前会恢复自身环境，
  // 必须在 main() 生命周期内先捕获（与 node-repl-host 同理）。
  const pluginRoot = process.env.ZCODE_PLUGIN_ROOT ?? process.cwd();
  const handle = serveStdio(() => createPatentMcpServer({ pluginRoot }).server, {
    legacy: "reject",
  });
  const shutdown = () => {
    void handle
      .close()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  };
  installPatentProcessGuards({
    onOutputClosed: shutdown,
    process,
    writeStderr: (text) => process.stderr.write(text),
  });
  installPatentShutdownTriggers({ process, shutdown, stdin: process.stdin });
}

if (isMainThread && (await isDirectMcpEntrypoint(import.meta.url, process.argv[1]))) {
  void main().catch((error) => {
    process.stderr.write(
      `patent MCP server failed: ${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
