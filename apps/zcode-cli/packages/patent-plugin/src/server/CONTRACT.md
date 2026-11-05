# patent-server

专利域插件的 MCP stdio server 入口（adapters 层）：把 `src/server/tools/` 下的工具定义
装配成 MCP `Tool[]`，承担进程生命周期与后续阶段的 IO 适配（索引资产、案件目录、台账）。

不变量：

- **注册表唯一所有者**：工具清单只在 `tool-registry.ts` 维护；server.ts 只消费
  `toMcpPatentTools()` / `getPatentTool()`，单个工具对装配层不可见。
- **一个工具一个文件**：`tools/<name>.ts` 导出唯一 `PatentToolDefinition`；新增工具不改契约形状。
- **确定性优先**：工具 handler 纯计算、无 IO；副作用留到后续阶段经注入端口进入（adapters 层）。
- **错误一等对象**：handler 返回 `PatentToolResult`（ok/error 分支），异常兜底为
  `internal_error`，server 层归一化为 MCP `isError`；进程顶层只处理生命周期错误。
- **请求上下文 fail-closed**：`_meta["com.zcode/request-context"]` 解析失败按空上下文处理，
  顶层 `_meta` 永不当路由凭据。

与其它模块的交集 hook 点：

- `patent-tools`（app，后续阶段）：handler 的实现来源，经构造函数注入，server 不 import 具体实现。
- `patent-knowledge` / `patent-data`（adapters）：后续阶段的只读 db 与检索通道，
  句柄生命周期归本进程 `dispose()`。
