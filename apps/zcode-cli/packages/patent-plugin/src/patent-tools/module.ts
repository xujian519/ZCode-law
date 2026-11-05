/**
 * patent-tools 模块清单（architecture-governance managed 模块）。
 * 层：app。修改 requires 时同步更新 architecture-policy.yaml（检查器会校验两者一致）。
 */
export const patentToolsModule = {
  id: "patent-tools",
  requires: [],
  provides: ["patent-tools"],
  publicEntrypoints: ["index.ts", "contract.ts"],
} as const;
