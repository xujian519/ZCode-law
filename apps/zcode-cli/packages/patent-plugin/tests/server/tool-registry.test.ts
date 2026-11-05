import { describe, expect, it } from "vitest";

import { PATENT_DOMAIN_ID, PATENT_SERVER_VERSION } from "../../src/server/contract.js";
import {
  getPatentTool,
  patentToolRegistry,
  toMcpPatentTools,
} from "../../src/server/tool-registry.js";
import {
  PATENT_STATUS_TOOL_NAME,
  patentStatusOutputSchema,
} from "../../src/server/tools/patent_status.js";

// Phase 3 groundwork：注册表纯逻辑验收（不 spawn 子进程；stdio 装配由 build + 直跑验证覆盖）。

const SNAKE_CASE_NAME = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

describe("patent-server 工具注册表", () => {
  it("注册表非空，且工具名均为 snake_case 且不重复", () => {
    expect(patentToolRegistry.length).toBeGreaterThan(0);
    const names = patentToolRegistry.map((tool) => tool.name);
    for (const name of names) {
      expect(name, `工具名 ${name} 必须是 snake_case`).toMatch(SNAKE_CASE_NAME);
    }
    expect(new Set(names).size).toBe(names.length);
  });

  it("每个工具的 zod schema 可解析入参且 description 非空", () => {
    for (const tool of patentToolRegistry) {
      expect(tool.description.length, `${tool.name} 的 description`).toBeGreaterThan(0);
      expect(tool.inputSchema.safeParse, `${tool.name} 的 inputSchema 必须是 zod schema`).toBeTypeOf(
        "function",
      );
    }
  });

  it("toMcpPatentTools 装配出 MCP Tool[]（name/description/inputSchema 齐备）", () => {
    const tools = toMcpPatentTools();
    expect(tools).toHaveLength(patentToolRegistry.length);
    for (const tool of tools) {
      expect(tool.name).toMatch(SNAKE_CASE_NAME);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      // SDK 的 inputSchema 最小形状：type === "object"
      expect((tool.inputSchema as { type?: string }).type).toBe("object");
    }
  });

  it("getPatentTool 按名查找：命中与未命中", () => {
    expect(getPatentTool(PATENT_STATUS_TOOL_NAME)?.name).toBe(PATENT_STATUS_TOOL_NAME);
    expect(getPatentTool("not_a_real_tool")).toBeUndefined();
  });

  it("patent_status handler 返回 domain/version/capabilities 结构", async () => {
    const tool = getPatentTool(PATENT_STATUS_TOOL_NAME);
    expect(tool).toBeDefined();
    const result = await tool!.handler(
      {},
      { requestContext: { runtime_scope: "main" }, signal: new AbortController().signal },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.domain).toBe(PATENT_DOMAIN_ID);
    expect(result.data.version).toBe(PATENT_SERVER_VERSION);
    expect(result.data.capabilities).toContain("status");
    // 返回结构必须通过工具自身的 output schema 校验
    expect(patentStatusOutputSchema.safeParse(result.data).success).toBe(true);
  });

  it("patent_status schema 拒绝未知字段（.strict()）", () => {
    const tool = getPatentTool(PATENT_STATUS_TOOL_NAME)!;
    expect(tool.inputSchema.safeParse({}).success).toBe(true);
    expect(tool.inputSchema.safeParse({ unexpected: 1 }).success).toBe(false);
  });
});
