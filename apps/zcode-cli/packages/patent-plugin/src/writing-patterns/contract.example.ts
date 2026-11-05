/**
 * patent-writing-patterns 标准调用示例：agent 靠模仿写代码，这里放的就是该模仿的那份。
 */
import { PATTERN_CATEGORIES } from "./index.js";
import type { PatentWritingPatternsContract } from "./contract.js";

export function examplePatentWritingPatterns(contract: PatentWritingPatternsContract): void {
  // 加载随包语料（fail-loud），按案件特征做确定性匹配：
  const store = contract.loadPatternStore();
  const matched = store.match({ caseType: "oa", features: ["创造性"], limit: 3 });
  // 编译为 <writing_skills> 块注入 system-prompt section：
  const skills = contract.compileWritingSkills(matched);
  const sectionText = contract.renderWritingSkillsSection(skills);
  // 注入类目的选择去重规则（跨类目同模式只列一次）：
  const injected = contract.sectionPatterns(store, PATTERN_CATEGORIES);
  void sectionText;
  void injected;
}
