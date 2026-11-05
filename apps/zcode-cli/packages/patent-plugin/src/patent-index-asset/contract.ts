/**
 * patent-index-asset 对外契约：调用方要想正确调用就必须知道的一切都写在这里；其余对外不可见。
 *
 * 不变量：所有读取器要么返回资产声明的值，要么用调用方注入的 AssetFail 工厂拒绝
 * 整个文件（拒绝强转）；错误类型由调用方工厂决定，本模块只保证 AssetFail 的签名。
 * 实现即 src/index.ts 的同名导出（纯库，无副作用、无状态、无事件）。
 */
import type { AssetFail } from "./errors.js"
import type { RecordedSource } from "./source.js"

export type PatentIndexAssetId = string & { readonly __brand: "PatentIndexAssetId" };

export type { AssetFail, RecordedSource };

/** 随包事实索引（法条/费用）共用的资产字段读取契约。 */
export interface PatentIndexAssetContract {
  /** 把资产文件文本解析为根映射；根节点不是映射时经 fail 拒绝。 */
  parseYamlMapping(source: string, label: string, fail: AssetFail): Record<string, unknown>;
  /** 要求一个值是映射，否则经 fail 拒绝。 */
  readMapping(value: unknown, where: string, fail: AssetFail): Record<string, unknown>;
  /** 必填非空字符串字段。 */
  readString(root: Record<string, unknown>, field: string, fail: AssetFail): string;
  /** 可缺省字段：缺省/null 返回 null，否则必须是非空字符串。 */
  readOptionalString(root: Record<string, unknown>, field: string, fail: AssetFail): string | null;
  /** 可缺省字段：缺省/null 返回 null，否则必须是 YYYY-MM-DD。 */
  readOptionalDate(root: Record<string, unknown>, field: string, fail: AssetFail): string | null;
  /** 必填正整数。 */
  readCount(value: unknown, where: string, fail: AssetFail): number;
  /** 可缺省正整数字段。 */
  readOptionalCount(root: Record<string, unknown>, field: string, fail: AssetFail): number | null;
  /** 可缺省布尔字段。 */
  readOptionalBoolean(root: Record<string, unknown>, field: string, fail: AssetFail): boolean | null;
  /** 必填闭集枚举，返回值窄化为集合成员。 */
  readEnum<T extends string>(value: unknown, allowed: readonly T[], where: string, fail: AssetFail): T;
  /** 读取一条转录条目的来源与核验日期（未转录时为 null）。 */
  readRecordedSource(entry: Record<string, unknown>, fail: AssetFail): RecordedSource;
}
