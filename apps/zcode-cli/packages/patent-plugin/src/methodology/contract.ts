/**
 * patent-methodology 对外契约：调用方要想正确调用就必须知道的一切都写在这里；其余对外不可见。
 *
 * 不变量：数据访问是纯函数式读随包资产（39×39 矩阵、40 原理、5 分离原理），结果
 *  memoize 于模块内；validateTrizAssets 在任何查表调用之前执行，畸形资产必须在
 * 加载期失败而非首次调用期。triz 工具的输入/输出类型见 tool-types.ts，确定性逻辑
 * 与模型可见文案见 tool-logic.ts（P3 的 patent-tools 消费）。无事件、无持久化等待。
 */
import type { TrizAssets } from "./data.js"
import type { TrizParameter, TrizPrinciple, TrizSeparation } from "./types.js"

export type PatentMethodologyId = string & { readonly __brand: "PatentMethodologyId" };

export type { TrizAssets, TrizParameter, TrizPrinciple, TrizSeparation };

/** TRIZ 查表数据访问契约。 */
export interface PatentMethodologyContract {
  /** 读 39×39 矛盾矩阵，索引 [worsening-1][improving-1]。 */
  loadMatrix(): number[][][];
  /** 查 improving×worsening 单元格，源序去重；越界返回 []。 */
  lookupMatrixCell(paramImproving: number, paramWorsening: number): number[];
  /** 读 40 个发明原理，按编号序。 */
  loadPrinciples(): TrizPrinciple[];
  /** 按编号解析原理；未知编号返回 undefined。 */
  principleById(no: number): TrizPrinciple | undefined;
  /** 读 5 个分离原理，按定义序。 */
  loadSeparations(): TrizSeparation[];
  /** 校验随包资产集（默认读随包文件），畸形时抛错点名每个违规项。 */
  validateTrizAssets(assets?: TrizAssets): void;
  /** 参数编号 → 展示名；未知编号回退为数字字符串。 */
  paramLabel(no: number): string;
  /** 原理编号列表 → "N name" 逗号连接文本。 */
  principleNames(ids: readonly number[]): string;
}
