/**
 * patent-core 本地工具函数。
 *
 * 文件头说明（移植规则）：本文件是替代 DSH workspace 依赖的最小等价实现。
 * 源包 patent-core 依赖 `@deepseek-ai/dsh-util-values` 的 `assertNever` 与
 * `@deepseek-ai/dsh-value` 的 `isRecord`/`asRecord`；ZCode 侧不迁入这两个
 * workspace 包，按 docs/patent-domain/architecture.md 的纯领域库移植裁决，
 * 在模块内以标准定义就地实现，行为与 DSH 原实现一致（见各函数 JSDoc）。
 */

/**
 * 穷尽性断言：switch 的 closed union 未处理分支在调用点失败。
 * @param value - 不可能到达的值；类型上未处理的变体在调用点即报错。
 * @param context - 可选的 switch 位置标签，附在失败消息中。
 * @returns never；运行时真实逃逸出类型的值总是抛错。
 */
export function assertNever(value: never, context?: string): never {
  const rendered = (JSON.stringify(value) as string | undefined) ?? String(value)
  throw new Error(`unreachable variant${context ? ` in ${context}` : ''}: ${rendered}`)
}

/**
 * 类型守卫：value 是否为普通记录对象（非 null、非数组）。
 * @param value - 待判断的未知值。
 * @returns 是否为记录对象。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 以记录对象读取不可信值：与 isRecord 同一判定，命中时返回该记录本身而非布尔值，
 * 便于解码器直接把值交给字段读取。
 * @param value - 待读取的未知值。
 * @returns 记录对象本身；非记录时返回 null。
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}
