# patent-core

patent-core 是专利域纯领域库：确定性引擎与类型词汇（atoms/checker/claim-chart/evidence/graph/novelty/infringement/draft/IPC/workflow manifest 等），迁入自 DSH `@deepseek-ai/dsh-patent-core`（Phase 2），剥除 Cordis 耦合。

不变量：

- 纯库无 IO：不直接调 `fetch`/网络；LLM 消费只经 `PatentModelPort` 注入（ZCode 工具不内部调 LLM，语义反转见 tools.md），检索只经 `StageProvider.search` 注入。
- `setup_required` 的 fail-loud 错误向上传播，任何原子/工具不得降级吞掉。
- 超 800 行的两个源文件按职责拆分（engine.ts → engine-evaluators.ts；ipc-classifier.ts → ipc-domains.ts），公开导出面经再导出保持不变。
- 与 patent-methodology 的跨模块边（triz）经 `../methodology/index.js` 公开入口；DSH util/llm/attachment 依赖以 `utils.ts`/`harness-bridge.ts` 本地等价物替代。
