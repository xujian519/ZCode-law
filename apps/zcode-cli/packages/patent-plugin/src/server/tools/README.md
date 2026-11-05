# patent-server 工具接线说明

每个工具一个文件，注册表统一装配；加工具时**只动两个文件**。

## 步骤

1. 新建 `src/server/tools/<tool_name>.ts`（snake_case，与工具名同名），导出一个
   `PatentToolDefinition`：

   ```ts
   import { z } from "zod";
   import type { PatentToolDefinition } from "../contract.js";

   export const myToolTool: PatentToolDefinition<MyInput, MyOutput> = {
     name: "my_tool",
     description: MY_TOOL_DESCRIPTION, // 命名常量，不写散字面量
     inputSchema: z.object({ /* ... */ }).strict(),
     handler: async (input, context) => {
       // 确定性、无副作用；IO 走注入端口（后续阶段）
       // 失败返回 { ok: false, error: { code, message } }，不要 throw 到进程顶层
     },
   };
   ```

2. 在 `src/server/tool-registry.ts` 的 `patentToolRegistry` 数组追加 import 与元素。

3. （必须）在 `tests/server/tool-registry.test.ts` 补该工具的 schema/handler 断言；
   有行为改动时按根 AGENTS.md 先补测试。

## 约定

- 入参 schema 一律 zod，`.strict()` 拒绝未知字段；`requestContextSchema` 已在
  `contract.ts` 定义，handler 经 `context.requestContext` 取用（可透传勿强依赖）。
- 字符串常量提取为命名常量；单文件 ≤800 行。
- 工具返回结构变化 = 契约变化：先改 `contract.ts` 注释与 CONTRACT.md，再改实现。
- 模型侧可见名为 `mcp__patent__<tool_name>`，名称一旦发布不改名（技能已全量引用）。
