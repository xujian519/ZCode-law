/**
 * patent-server 标准调用示例：agent 靠模仿写代码，这里放的就是该模仿的那份。
 * 展示最常见的调用路径：从注册表取工具定义 → zod 解析入参 → 调 handler → 判 ok 分支。
 */
import type { PatentToolHandlerContext } from "./contract.js";
import { getPatentTool } from "./tool-registry.js";

export async function examplePatentServer(
  toolName: string,
  rawArguments: unknown,
): Promise<unknown> {
  const tool = getPatentTool(toolName);
  if (!tool) throw new Error(`unknown patent tool: ${toolName}`);
  const parsed = tool.inputSchema.safeParse(rawArguments ?? {});
  if (!parsed.success) throw new Error(`${toolName}: ${parsed.error.issues[0]?.message}`);
  const context: PatentToolHandlerContext = {
    requestContext: { runtime_scope: "main" },
    signal: new AbortController().signal,
  };
  const result = await tool.handler(parsed.data, context);
  if (!result.ok) throw new Error(`${toolName} failed: ${result.error.code}`);
  return result.data;
}
