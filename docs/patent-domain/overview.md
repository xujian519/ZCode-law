# 专利域总览（移植 spec）

- 状态：已批准（2026-10-21 计划评审），Phase 0 产物
- 来源仓库：`/Users/xujian/projects/deepseek-harness`（下称 DSH）
- 目标落点：`apps/zcode-cli/packages/patent-plugin/`（`@zcode/patent-plugin`）

## 领域边界

专利域覆盖中国专利申请与争议全流程的模型面向能力：

- 交底书理解（PFIE 四元组）、现有技术检索、新颖性/创造性/实用性分析
- 权利要求与说明书撰写、形式与质量校验
- 审查意见答复、复审、无效宣告（请求人/专利权人两侧）、侵权比对
- 法条/审查指南/判例核验，规则门禁与交付门禁
- 期限/费用计算，案件（matter）状态与事件日志
- 附图生成/分析/校验，申请文件（CNIPA DOCX）组装
- 学术文献检索（技术调研），TRIZ 与撰写模式语料

不覆盖（明确出界）：

- 多智能体团队调度器本体（与 ZCode subagent runtime 重叠，裁决见 [overlap-decisions.md](overlap-decisions.md)）
- 用户级技能库 `~/.agents/skills/` 的既有专利 skill（保留不动，可叠加使用）
- DSH 通用行能力（shell/fs/jobs/web/goal/plan-mode/compaction/delegation）：ZCode runtime 已自带，不作为本域移植内容
- DSH 的 self-evolve-benchmark 与 openviking 外部集成（部署特性，非域能力）

## 来源包到目标模块的映射

| DSH 包 | 行数（src/tests） | 目标 managed module（`src/` 下） | 目标层 | 迁入阶段 |
|---|---|---|---|---|
| `patent-core` | 24,006 / 17,068 | `patent-core` | domain | P2 |
| `patent-index-asset` | 354 / — | `patent-index-asset` | domain | P2 |
| `methodology` | 1,265 / — | `methodology` | domain | P2 |
| `writing-patterns` | 2,512 / — | `writing-patterns` | domain | P2 |
| `patent-law` | 4,777 / — | `patent-law` | domain | P2 |
| `patent-fees` | 2,834 / — | `patent-fees` | domain | P2 |
| `patent-deadline` | 4,261 / — | `patent-deadline` | domain | P2 |
| `patent-rule` | 8,926 / — | `patent-rule` | domain | P3 |
| `patent-knowledge` | 6,956 / — | `patent-knowledge`（+ `patent-knowledge-install` bin） | adapters | P3 |
| `patent-workflow` | 8,690 / — | `patent-workflow`（manifest/executor/plantask/docket） | domain | P6 |
| `patent-data` | 4,713 / — | `patent-data` | adapters | P4 |
| `tool-literature` | 5,196 / — | `tool-literature` | adapters | P4 |
| `patent-tools` | 32,164 / 29,906 | `patent-tools`（按工具组拆子模块） | app | P3–P6 |
| `patent-document` | 7,963 / — | `patent-document` | adapters | P5 |
| `patent-filing` | 3,640 / — | `patent-filing`（含 Python 引擎脚本与模板资产） | adapters | P5 |
| `patent-teams` | 11,471 / — | 见 overlap-decisions.md 裁决 | — | P6 |
| `ui-patent-teams`（client 侧） | 2,619 / — | 随 teams 裁决；如需则 ui surface | ui | P6 |
| bundle preset `patent.patch.yml` | 632 行 | `agents/` 人设 + `plugin.json` + 技能 | — | P1/P7 |
| 16 个技能 | — | `patent-plugin/skills/` | — | P1 |

外部依赖随迁：`yaml@^2.9.0`、`@viz-js/viz@^3.29.0`、vendored `nuo-patent`（768K 预编译，含 cheerio/domhandler/undici）；外部命令 ego-browser / cnlaw(REST) / FreeCAD / Inkscape / Chrome / Python 一律「缺失即明确报错」，不静默降级。

## 全局约定

1. **先 spec 后代码**：本目录五份文档是专利域唯一权威设计来源；实现与文档冲突时先改文档。
2. **架构治理**：`apps/zcode-cli/packages/patent-plugin/` 下所有新文件属 managed module（architecture-policy.yaml 登记）；分层遵守 `contract < domain < app < adapters < ui`；domain 无 IO、无对世界的 `await`。
3. **语义反转原则**：DSH 工具体内的 LLM 调用（ModelPort）不原样搬入。确定性的留在工具内；需要模型判断的改为「技能编排模型产出 → 确定性工具校验」；`LlmPort` 接口保留在 domain 层以维持可测试性。
4. **门禁原则**：交付前置门禁（deliveryGate）、制品结构门禁（structuralGate）、输出门禁（post-execute）在 ZCode 无 runtime 工具钩子，落为：工具自身的入参/出参校验 + 技能 Fail-Closed 步骤 + MCP server 会话内台账（见 [tools.md](tools.md) 门禁一节）。
5. **单一事实源**：案件状态唯一事实源是案件目录 `_matter-log.md`（只追加）；MCP server 进程态与工作台均为投影（见 [matter-state.md](matter-state.md)）。
6. **中文注释纪律**：对源代码的任何语义改动（剥 Cordis、改 LLM 语义、替换 util）必须中文注释说明原因与依据。
7. **验证纪律**：每阶段完成 `pnpm --dir apps/zcode-cli typecheck/lint/test` + `pnpm architecture:check --changed` 全绿。

## 文档索引

- [architecture.md](architecture.md) — 模块清单、分层、依赖方向、事件所有者
- [tools.md](tools.md) — 60 个 MCP 工具目录、命名对照、LLM 反转清单、门禁结构
- [matter-state.md](matter-state.md) — 案件/计划/workflow 状态机、事件顺序、幂等边界
- [overlap-decisions.md](overlap-decisions.md) — 能力重叠逐条裁决
