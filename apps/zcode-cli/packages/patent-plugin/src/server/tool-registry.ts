/**
 * 工具注册表：patent-server 的唯一工具清单所有者。
 * 新增工具 = 在 `tools/<name>.ts` 导出一个 PatentToolDefinition，并在下方数组追加 import。
 * server.ts 只从这里的 `toMcpPatentTools()` 装配 MCP `Tool[]`，不感知单个工具。
 */
import type { Tool } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { PatentToolDefinition } from "./contract.js";
import { patentStatusTool } from "./tools/patent_status.js";

export const patentToolRegistry: readonly PatentToolDefinition[] = [patentStatusTool];

/** 供测试与 server 层按名查找；未命中返回 undefined，由调用方归一化为错误。 */
export function getPatentTool(name: string): PatentToolDefinition | undefined {
  return patentToolRegistry.find((tool) => tool.name === name);
}

/**
 * 把注册表装配成 MCP `Tool[]`。zod → JSON Schema 的转换集中在这里，
 * 与 node-repl-host 同款 cast：SDK 的 inputSchema 类型只保证 object 形状的最小公共面。
 */
export function toMcpPatentTools(): Tool[] {
  return patentToolRegistry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema) as Tool["inputSchema"],
  }));
}
