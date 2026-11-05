import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Phase 1 结构验收：插件声明、技能/agent 清单、工具引用改写合同。
// 路径以本测试文件所在包为根（vitest 以 apps/zcode-cli 为 cwd 时同样成立，此处用 import.meta.url 推导）。

const pkgRoot = join(new URL(".", import.meta.url).pathname, "..");

function readFrontmatter(filePath: string): Record<string, unknown> {
  const text = readFileSync(filePath, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  expect(match, `${filePath} 缺少 YAML frontmatter`).toBeTruthy();
  const fields: Record<string, unknown> = {};
  for (const line of match![1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
}

describe("patent-plugin 结构", () => {
  it("plugin.json 声明 skills 与 agents 目录且目录存在", () => {
    const manifest = JSON.parse(readFileSync(join(pkgRoot, ".zcode-plugin/plugin.json"), "utf8"));
    expect(manifest.name).toBe("patent");
    expect(manifest.skills).toBe("skills");
    expect(manifest.agents).toBe("agents");
    expect(existsSync(join(pkgRoot, manifest.skills))).toBe(true);
    expect(existsSync(join(pkgRoot, manifest.agents))).toBe(true);
  });

  it("16 个技能各有合法 frontmatter（name 与目录同名、description 非空）", () => {
    const skillsDir = join(pkgRoot, "skills");
    const dirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(dirs).toHaveLength(16);
    for (const dir of dirs) {
      const fm = readFrontmatter(join(skillsDir, dir, "SKILL.md"));
      expect(fm.name, `${dir} 的 name`).toBe(dir);
      expect(String(fm.description ?? "").length, `${dir} 的 description`).toBeGreaterThan(0);
    }
  });

  it("agents 有合法 frontmatter（name/description/tools）", () => {
    const agentsDir = join(pkgRoot, "agents");
    const files = readdirSync(agentsDir).filter((name) => name.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      const fm = readFrontmatter(join(agentsDir, file));
      expect(String(fm.name ?? "").length, `${file} 的 name`).toBeGreaterThan(0);
      expect(String(fm.description ?? "").length, `${file} 的 description`).toBeGreaterThan(0);
      expect(String(fm.tools ?? "").length, `${file} 的 tools`).toBeGreaterThan(0);
    }
  });

  it("技能与 agents 不引用未迁移的 teams 工具", () => {
    const texts = [
      ...readdirSync(join(pkgRoot, "skills")).map((dir) =>
        readFileSync(join(pkgRoot, "skills", dir, "SKILL.md"), "utf8"),
      ),
      ...readdirSync(join(pkgRoot, "agents"))
        .filter((name) => name.endsWith(".md"))
        .map((name) => readFileSync(join(pkgRoot, "agents", name), "utf8")),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/patent_teams_[a-z_]+/);
    }
  });

  it("专利工具引用一律为 mcp__patent__ 前缀形式（无裸名）", () => {
    const dirs = readdirSync(join(pkgRoot, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const bare = /\b(?<!mcp__patent__)(patent_(?:search|metadata|legal_status|pdf_download|case_search|kg_query|wiki_search|deadlines|fees|workflow_run|workflow|analysis_report|plan_task|eval|worker_validate|figure|filing)|law_search|law_verify|rule_check|claim_chart_build|parse_office_action|draft_claims|draft_specification|validate_specification|evaluate_evidence|matter_log_append|knowledge_note_save|flexible_plan|triz_contradiction_analysis|render_patent_document|verify_deliverable|build_patent_filing|verify_patent_filing|search_patent_figure|paper_search|paper_download|paper_list_sources|query_writing_patterns|workbench_link_patent_case|add_patent_figure_references|verify_patent_figure|analyze_patent_figure|generate_patent_figure|generate_structure_figure|recognize_chemical_structure|triz)\b/g;
    for (const dir of dirs) {
      const text = readFileSync(join(pkgRoot, "skills", dir, "SKILL.md"), "utf8");
      const hits = text.match(bare);
      expect(hits, `${dir} 存在未加前缀的工具引用: ${JSON.stringify(hits)}`).toBeNull();
    }
  });
});
