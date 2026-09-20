import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAllowedLcjInternalImageAsset } from "./lcjBrainProjectRouter";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("LCF exhibition brain integration", () => {
  it("offers a dedicated internal playbook tool for quarterly exhibition questions", () => {
    const tools = source("./lcjBrainTools.ts");
    const brain = source("./lcjBrain.ts");
    expect(tools).toContain('name: "get_lcf_event_playbook"');
    expect(tools).toContain('source: "LCJ Brain内部知识库"');
    expect(tools).toContain("LCF-20260908-FIRST-KNOWHOW:knowledge:");
    expect(brain).toContain("必须先调用get_lcf_event_playbook");
    expect(brain).toContain("requiresLcfEvidence");
    expect(brain).toContain('id: "server-lcf-evidence"');
    expect(brain).toContain("await executeToolCall({");
    expect(brain).not.toContain("executeBrainTool(");
    expect(brain).toContain("LCF展会内部知识正在初始化");
    expect(brain).toContain("knowledgeSources,");
  });

  it("renders internal sheets, internal images and structured workflow details", () => {
    const ui = source("../client/src/components/LcjBrainProjects.tsx");
    const router = source("./lcjBrainProjectRouter.ts");
    expect(ui).toContain("LCJ Brain内部完整资料");
    expect(ui).toContain("LCF原始照片总览");
    expect(ui).toContain("加载更多照片（${assets.length}/${total}）");
    expect(ui).toContain("已显示全部 {total} 张照片");
    expect(ui).toContain("此工作表没有原始照片 · 显示LCJ内部表格视觉封面");
    expect(ui).toContain("原始资料照片 · 已保存至LCJ内部");
    expect(ui).toContain("表格视图");
    expect(ui).toContain("逐格文字");
    expect(ui).toContain("LCJ内部图片资料");
    expect(ui).toContain("完整执行流程");
    expect(ui).toContain("完成 / 验收标准");
    expect(ui).toContain("问下次展会");
    expect(ui).not.toContain("查看原始来源");
    expect(router).toContain("safeStructuredContent");
    expect(router).toContain("delete safeRow.storageKey");
    expect(router).toContain("sourceAssets: protectedProcedure");
    expect(router).toContain("projectAssets: protectedProcedure");
    expect(router).toContain("Promise.allSettled");
    expect(router).toContain("nextCursor:");
    expect(router).toContain("storageKey = cleanText(image?.storageKey");
  });

  it("signs only server-owned LCJ bitmap asset keys", () => {
    const valid = {
      storageKey:
        "private/lcj-brain/lcf-20260908/images/123e4567-e89b-42d3-a456-426614174000.webp",
      mimeType: "image/webp",
      byteSize: 2048,
    };
    expect(isAllowedLcjInternalImageAsset(valid)).toBe(true);
    expect(
      isAllowedLcjInternalImageAsset({
        ...valid,
        storageKey: "private/finance/payroll/secret.pdf",
      })
    ).toBe(false);
    expect(
      isAllowedLcjInternalImageAsset({
        ...valid,
        storageKey: "private/lcj-brain/lcf-20260908/images/../../secret.webp",
      })
    ).toBe(false);
    expect(
      isAllowedLcjInternalImageAsset({ ...valid, mimeType: "image/svg+xml" })
    ).toBe(false);
    expect(
      isAllowedLcjInternalImageAsset({ ...valid, byteSize: 11 * 1024 * 1024 })
    ).toBe(false);
  });

  it("copies images to private storage and seeds 37 searchable knowledge entries", () => {
    const seed = source("./lcfFirstEditionProjectSeed.ts");
    expect(seed).toContain("private/lcj-brain/lcf-20260908/images/");
    expect(seed).toContain("EXPECTED_INTERNAL_IMAGE_MINIMUM = 66");
    expect(seed).toContain("readResponseWithLimit");
    expect(seed).toContain("limitInputPixels: MAX_INTERNAL_IMAGE_PIXELS");
    expect(seed).toContain("crypto.randomUUID()");
    expect(seed).toContain('health.projectStatus === "archived"');
    expect(seed).toContain(
      "LCF projectCode collision with an unrecognized project"
    );
    expect(seed).toContain("for (let attempt = 1; attempt <= 3; attempt += 1)");
    expect(seed).toContain("schema_upgrade_failed");
    expect(seed).toContain(
      "EXPECTED_KNOWLEDGE_COUNT = EXPECTED_SHEET_COUNT + 1"
    );
    expect(seed).toContain("LCF展会运营总大脑｜每季度可复用完整SOP");
    expect(seed).toContain("LCJ内部工作表：");
    expect(seed).toContain("sourceUrl=NULL");
    expect(seed).toContain("templateCode=VALUES(templateCode)");
  });

  it("automatically writes every archived project SOP into the Brain knowledge base", () => {
    const router = source("./lcjBrainProjectRouter.ts");
    const upgrade = source("./lcjBrainProjectUpgrade.ts");
    expect(router).toContain("LCJ-BRAIN-PROJECT-SOP:");
    expect(router).toContain("项目归档时自动沉淀的可复用流程知识");
    expect(router).toContain("knowledgeId");
    expect(upgrade).toContain("ensureMysqlColumns");
    expect(upgrade).not.toContain("ADD COLUMN IF NOT EXISTS structuredContent");
  });
});
