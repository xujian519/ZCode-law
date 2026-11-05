/**
 * patent-rule 模块清单（architecture-governance managed 模块）。
 * 层：domain。修改 requires 时同步更新 architecture-policy.yaml（检查器会校验两者一致）。
 */
export const patentRuleModule = {
  id: "patent-rule",
  requires: [],
  provides: ["patent-rule"],
  publicEntrypoints: ["index.ts", "contract.ts"],
} as const;
