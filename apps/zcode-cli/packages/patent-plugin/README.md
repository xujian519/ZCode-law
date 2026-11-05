# @zcode/patent-plugin

ZCode 专利域插件：专利检索、专利性分析、撰写、审查意见答复、侵权/无效、期限费用与案件管理。

- 设计文档（唯一权威来源）：[`docs/patent-domain/`](../../../../docs/patent-domain/)
  - [overview.md](../../../../docs/patent-domain/overview.md) — 领域边界与包映射
  - [architecture.md](../../../../docs/patent-domain/architecture.md) — 模块、分层与依赖方向
  - [tools.md](../../../../docs/patent-domain/tools.md) — MCP 工具目录与门禁结构
  - [matter-state.md](../../../../docs/patent-domain/matter-state.md) — 案件状态与事件顺序
  - [overlap-decisions.md](../../../../docs/patent-domain/overlap-decisions.md) — 能力重叠裁决

## 结构

- `skills/` — 16 个专利技能（模型经 `Skill` 工具按需加载）
- `agents/` — 可派发的专利评审角色（专利代理模式、对立审查员）
- `src/` — 领域模块（managed modules，架构治理登记见 `architecture-policy.yaml`）
- `assets/` — YAML 语料资产（法规/费用/规则/撰写模式）

## 当前状态

分阶段移植中：技能与 agents 先行（P1），领域库与 MCP 工具随后续阶段上线（见设计文档）。
工具上线前，技能正文中标注 `mcp__patent__*` 的工具引用处于「未上线」状态，技能会明示降级行为。
