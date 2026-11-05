# patent-methodology

TRIZ 推理层纯库：40 个发明原理、39×39 Altshuller 矛盾矩阵、5 个分离原理的随包 JSON 资产查表（源：DSH `@deepseek-ai/dsh-methodology`）。意图：给技能编排与 `triz` 工具（P3 由 patent-tools 重建）提供确定性的矛盾矩阵落格与目录列举能力。不变量：`validateTrizAssets` 必须先于任何查表调用执行，畸形/缺失资产在加载期 fail-loud；矩阵读取按源序去重（源转写的 (19,9)=[8,35,35] 单重复单元格保留原值）；空对角线格解释为物理矛盾并给出分离原理，234 个非对角线空格只报告矩阵缺口。资产随模块共置于 `src/methodology/assets/`，`data.ts` 以 `import.meta.url` 锚定相对路径。与其它模块的交集：tool-types.ts/tool-logic.ts 是 P3 patent-tools 重建 `triz` 工具（`mcp__patent__triz`）的类型与逻辑来源；Cordis 插件壳不迁。
