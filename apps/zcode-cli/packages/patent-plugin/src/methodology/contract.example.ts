/**
 * patent-methodology 标准调用示例：agent 靠模仿写代码，这里放的就是该模仿的那份。
 */
import type { PatentMethodologyContract } from "./contract.js";

export function examplePatentMethodology(contract: PatentMethodologyContract): void {
  // 启动期先校验随包资产，畸形/缺失在加载期 fail-loud。
  contract.validateTrizAssets();
  // 交底书矛盾「强度 ↑ 导致运动物体重量 ↑」的矩阵落格：
  const recommended = contract.lookupMatrixCell(14, 1);
  const names = contract.principleNames(recommended);
  void names;
}
