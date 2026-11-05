import { describe, expect, it } from "vitest";

import {
  PATENT_SERVER_NAME,
  PATENT_SERVER_VERSION,
  REQUEST_CONTEXT_META_KEY,
  requestContextSchema,
} from "./contract.js";
import { patentServerModule } from "./module.js";
import { patentToolRegistry } from "./tool-registry.js";

// 契约测试只 import contract 与 module，不知道实现是谁；同一份测试应同时跑真实现与跨进程代理。
describe("patent-server contract", () => {
  it("declares its module manifest", () => {
    expect(patentServerModule.id).toBe("patent-server");
  });

  it("server 身份常量与 plugin.json mcpServers 键一致", () => {
    expect(PATENT_SERVER_NAME).toBe("patent");
    expect(PATENT_SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("requestContextSchema 解析失败时 fail-closed（不抛错、不透传未知路由字段语义）", () => {
    expect(requestContextSchema.safeParse(undefined).success).toBe(false);
    const parsed = requestContextSchema.safeParse({
      trace_id: "trace-1",
      session_id: "session-1",
      unknown_future_field: "kept",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.trace_id).toBe("trace-1");
      // passthrough：第三方扩展字段原样保留
      expect(parsed.data.unknown_future_field).toBe("kept");
    }
    expect(REQUEST_CONTEXT_META_KEY).toBe("com.zcode/request-context");
  });

  it("注册表内工具名互不重复", () => {
    const names = patentToolRegistry.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
