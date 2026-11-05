# 专利域架构（移植 spec）

- 权威政策文件：`architecture-policy.yaml`（模块登记以它为准，本文档是设计与迁移说明）
- 落点：`apps/zcode-cli/packages/patent-plugin/`
- owner：`plugin`（沿用现有 owner 分组取值）

## 包结构

```text
apps/zcode-cli/packages/patent-plugin/
├── .zcode-plugin/plugin.json      # 插件声明（skills/agents/mcpServers[/ui.surfaces]）
├── package.json                   # @zcode/patent-plugin（private）
├── tsconfig.json
├── README.md
├── skills/                        # 16 个专利技能（P1）
├── agents/                        # 人设与评审角色（P1）
├── assets/                        # 仅放跨模块共享资产与 vendored 引擎
│   └── vendor/nuo-patent/         # vendored 检索引擎（P4，third-party 登记；在 tsconfig include 之外）
├── src/
│   ├── patent-core/               # domain：atoms/checker/claim-chart/problem/evidence/
│   │                              #   reasoning/graph/novelty/infringement/draft/IPC + LlmPort
│   ├── patent-index-asset/        # domain：索引资产格式（law/fees 共用）
│   ├── methodology/               # domain：TRIZ 40 原理 + 39×39 矩阵
│   ├── writing-patterns/          # domain：撰写模式语料 + 编译
│   ├── patent-law/                # domain：法条索引与引用核验
│   ├── patent-fees/               # domain：官费年费索引与计价
│   ├── patent-deadline/           # domain：期限算术（节假日滚动）
│   ├── patent-rule/               # domain：规则引擎 + 门禁台账逻辑
│   ├── patent-workflow/           # domain：manifest/executor/DAG/plantask 状态机/docket
│   ├── patent-tools/              # app：60 个工具的 handler 与 schema 组合（消费上述 domain）
│   ├── server/                    # adapters：MCP stdio server 入口（组装 tools + IO 适配）
│   ├── patent-knowledge/          # adapters：knowledge.db 只读查询（FTS/KG/wiki/IPC）
│   ├── patent-data/               # adapters：nuo provider + ego-browser 会话 + CNIPR 通道
│   │   └── vendor/nuo-patent/     # vendored 检索引擎（P4，verbatim；lint 排除在配置层）
│   ├── tool-literature/           # adapters：arXiv/OpenAlex/Semantic Scholar/Crossref
│   ├── patent-document/           # adapters：13 模板渲染（HTML；PDF 走系统 Chrome）
│   └── patent-filing/             # adapters：CNIPA DOCX 组装（Python 引擎脚本，subprocess）
└── tests/                         # vitest（随源 spec 迁入，按源包分目录）
```

Python 引擎脚本（filing 的 4 个 .py）放 `patent-filing/assets/engine/`，运行时经 subprocess 调用，由 `patent-filing` 模块负责探测与报错。

资产落位决策（2026-10-21）：各包的 YAML 语料（法规/费用/期限工作历/撰写模式/TRIZ 数据）**随模块共置**于 `src/<mod>/assets/`，保持源仓库 `asset-location.ts` 的相对路径算术不变（源实现即以模块文件为锚）；这不违反分层——资产是被读取的数据，不是代码。verbatim 资产一律放在所属 managed module 根内（`src/<mod>/assets/`、`src/<mod>/vendor/`），让 `unmanaged-new-file` 规则自然满足，不走 upstream-snapshot（该机制服务于开源导出流水线，与一次性移植不匹配）；lint/编译排除在工具配置层解决（oxlint ignorePatterns、tsconfig 只编译 .ts）。vendored `nuo-patent` 放 `src/patent-data/vendor/nuo-patent/`。

## Managed modules 清单（architecture-policy.yaml 登记项）

| module id | roots | layer | requires | 说明 |
|---|---|---|---|---|
| `patent-core` | `apps/zcode-cli/packages/patent-plugin/src/patent-core` | domain | `patent-methodology` | 纯领域库；`LlmPort` 接口在此定义 |
| `patent-index-asset` | `.../src/patent-index-asset` | domain | — | 仅依赖 yaml |
| `patent-methodology` | `.../src/methodology` | domain | `patent-index-asset`?（以 adopt 推断为准） | TRIZ 数据 |
| `patent-writing-patterns` | `.../src/writing-patterns` | domain | `patent-core`? | 语料 + 编译 |
| `patent-law` | `.../src/patent-law` | domain | `patent-index-asset` | 法条索引 |
| `patent-fees` | `.../src/patent-fees` | domain | `patent-index-asset` | 费用索引 |
| `patent-deadline` | `.../src/patent-deadline` | domain | `patent-law`?（以 adopt 推断为准） | 期限算术 |
| `patent-rule` | `.../src/patent-rule` | domain | `patent-core` | 规则引擎 + 台账逻辑（IO 在 server 层） |
| `patent-workflow` | `.../src/patent-workflow` | domain | `patent-core` | 状态机与 manifest，持久化端口由调用方注入 |
| `patent-tools` | `.../src/patent-tools` | app | 上述全部 domain + adapters 契约 | 工具 handler；不直接做 IO（经注入端口） |
| `patent-server` | `.../src/server` | adapters | `patent-tools` | MCP stdio server：进程生命周期、会话台账、IO |
| `patent-knowledge` | `.../src/patent-knowledge` | adapters | `patent-tools`? | sqlite 只读；install bin |
| `patent-data` | `.../src/patent-data` | adapters | `patent-tools` | 网络/浏览器/子进程 |
| `patent-literature` | `.../src/tool-literature` | adapters | `patent-tools` | 文献 API |
| `patent-document` | `.../src/patent-document` | adapters | `patent-tools` | 模板 + 渲染 |
| `patent-filing` | `.../src/patent-filing` | adapters | `patent-tools` | DOCX + Python subprocess |

依赖方向约定：`adapters`（knowledge/data/literature/document/filing/server）可被 `patent-tools`(app) 经构造函数注入使用；domain 模块间按上表 `requires`；**禁止** domain → adapters、domain → app 反向依赖；模块内拆分子目录（如 `patent-tools/tool/`）属同模块文件，不受 deep-import 限制，但跨模块必须走公开入口。

> `requires` 列带「?」的以 `architecture:adopt` 从真实 import 推断为准；上表是预期，登记后以 yaml 为准并在本文档回填。

## 服务缝的 ZCode 等价

DSH 四服务缝（`ctx.patentData/patentKnowledge/patentWorkflow/patentTeams`）的落法：

| DSH 缝 | ZCode 落法 | 状态所有者 |
|---|---|---|
| `ctx.patentData` | `patent-data` 模块导出工厂（createSearchProvider/createEgoSession/createCniprChannel），由 `patent-server` 组装注入 `patent-tools` | 无状态（每次调用新建/缓存连接） |
| `ctx.patentKnowledge` | `patent-knowledge` 模块导出只读查询类；db 句柄生命周期归 server 进程 | server 进程（dispose 关闭） |
| `ctx.patentWorkflow` | `patent-workflow` 的纯 API；持久化经注入的 `JsonFileStore` 端口；审批经 server 的 HITL 映射 | 案件目录文件（见 matter-state.md） |
| `ctx.patentTeams` | 不搬（裁决 T1，见 overlap-decisions.md） | — |
| `ctx.patentRuleGate` | `patent-rule` 纯逻辑 + server 会话台账 | server 会话（台账），案件证据落 `_matter-log.md` |
| `ctx.llm`（ModelPort） | **不注入工具**。domain 保留 `LlmPort` 类型；server 提供 fail-loud 桩（setup_required），LLM 步骤由技能编排 | — |
| `ctx.approval` | 不接线 runtime approval；plantask 的 awaiting_approval 映射为 ZCode plan/approval 交互（见 matter-state.md） | 用户决策经会话记录 |

## 事件与日志

- ZCode 会话日志（`patent/workflow-run`、`patent/plantask`、`patent/model-call` 等 DSH 侧事件）不搬：DSH 事件进 agent session log，ZCode 的等价物是案件目录 `_matter-log.md`（唯一事实源）+ 交付物自身。`patent/model-call` 语义由「工具不再内部调 LLM」自然消解。
- server 进程日志走 MCP stdio 的 stderr/通知通道，不污染工具结果文本；禁止把凭据、内部地址写入日志（遵守根 AGENTS.md 日志纪律）。

## 上游准入与例外

- 被改造的源码文件（绝大多数）：managed modules 正常登记，不适用上游准入。
- verbatim 资产（YAML 法规/费用/规则/撰写模式语料、13 个渲染模板、技能文档、`申请文件模板.docx`、Python 引擎脚本、vendored nuo-patent）：一律放在所属 managed module 根内的 `assets/`/`vendor/` 子目录（见「资产落位决策」），`unmanaged-new-file` 自然满足；**不走** `acceptedUpstreamSnapshot`（该机制为开源导出流水线设计，需 Git blob 对象与导出器，和本仓库一次性移植不匹配）。
- 超 800 行的迁入文件（patent-core 2 个、patent-deadline 1 个、patent-tools 6 个、测试若干）：优先按职责拆分至合规；拆分会改变源文件结构的，按 policy `exceptions` 流程登记并注明原因。

## patent-server v1 骨架（Phase 3 groundwork，2026-10-21）

- `src/server/server.ts`：MCP stdio 入口（`@modelcontextprotocol/server` 2.0.0 + `serveStdio`），
  `tools/list` / `tools/call` 两个 handler 从 `tool-registry.ts` 装配；进程生命周期
  （SIGINT/SIGTERM/stdin 关闭优雅退出、异步错误降级 stderr、直跑检测）参照 node-repl-host 精简版。
- `src/server/tool-registry.ts`：工具清单唯一所有者；`tools/<name>.ts` 一工具一文件导出
  `PatentToolDefinition`（name/description/zod inputSchema/handler），注册表数组追加即接线。
- v1 唯一工具 `patent_status`：入参空对象，返回 `{ domain: "patent", version, capabilities }`，
  capabilities 现仅 `["status"]` 占位；确定性、无副作用。模型侧可见名 `mcp__patent__patent_status`。
- 统一请求上下文：`_meta["com.zcode/request-context"]`（trace_id/session_id/span 族），
  zod passthrough，fail-closed 解析；handler 经 context 透传，不强制消费。
- 错误一等对象：handler 返回 `PatentToolResult`（ok/error），server 层归一化为 MCP `isError`；
  工具异常兜底 `internal_error`，不抛穿进程顶层。
- 产物：`scripts/build.mjs` esbuild bundle → `dist/server.mjs`（esm/node24/createRequire banner），
  plugin.json `mcpServers.patent` 以 `node ${ZCODE_PLUGIN_ROOT}/dist/server.mjs` 启动。
