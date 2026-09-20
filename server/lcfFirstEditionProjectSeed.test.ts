import zlib from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLcfInternalSheetSnapshot,
  buildLcfFirstEditionSopContent,
  buildPositionedSheetImages,
  decodeQqWorksheetPayload,
  expectedLcfSheetNames,
  isLcfFirstEditionSeedHealthy,
  renderQqSheetMarkdown,
  summarizeLcfInternalSources,
} from "./lcfFirstEditionProjectSeed";
import { spreadsheetColumnName } from "../shared/spreadsheetCoordinates";

type Field = { field: number; wire: 0 | 1 | 2; value?: number; data?: Buffer };

function varint(input: number): Buffer {
  let value = BigInt(input);
  const bytes: number[] = [];
  do {
    let byte = Number(value & 0x7fn);
    value >>= 7n;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return Buffer.from(bytes);
}

function message(fields: Field[]): Buffer {
  return Buffer.concat(
    fields.flatMap(field => {
      const tag = varint((field.field << 3) | field.wire);
      if (field.wire === 0) return [tag, varint(field.value || 0)];
      if (field.wire === 1) return [tag, field.data || Buffer.alloc(8)];
      const data = field.data || Buffer.alloc(0);
      return [tag, varint(data.length), data];
    })
  );
}

function bytes(field: number, value: Buffer | string): Field {
  return {
    field,
    wire: 2,
    data: typeof value === "string" ? Buffer.from(value) : value,
  };
}

function integer(field: number, value: number): Field {
  return { field, wire: 0, value };
}

function syntheticSheet() {
  const strings = ["标题", "密码：not-a-real-secret", "普通内容"];
  const dictionary = message(
    strings.map(value => bytes(1, message([bytes(1, value)])))
  );
  const cell = (row: number, col: number, stringIndex: number) =>
    bytes(
      6,
      message([
        ...(row ? [integer(1, row)] : []),
        ...(col ? [integer(2, col)] : []),
        bytes(
          3,
          message([
            integer(1, 4),
            bytes(2, message(stringIndex ? [integer(1, stringIndex)] : [])),
          ])
        ),
      ])
    );
  const worksheet = message([
    bytes(3, message([bytes(1, "sheet-a")])),
    bytes(5, dictionary),
    cell(0, 0, 0),
    cell(1, 0, 1),
    cell(1, 1, 2),
  ]);
  const root = message([
    bytes(
      1,
      message([bytes(5, message([integer(1, 18), bytes(19, worksheet)]))])
    ),
  ]);
  return {
    clientVars: {
      collab_client_vars: {
        initialAttributedText: {
          text: [
            {
              related_sheet: zlib.deflateSync(root).toString("base64"),
              max_row: 2,
              max_col: 2,
            },
          ],
        },
      },
    },
  };
}

describe("LCF first edition QQ import", () => {
  it("decodes shared-string index zero and later cells without dropping content", () => {
    const decoded = decodeQqWorksheetPayload(syntheticSheet(), "测试表");
    expect(decoded.id).toBe("sheet-a");
    expect(decoded.cells.map(cell => cell.text)).toEqual([
      "标题",
      "密码：not-a-real-secret",
      "普通内容",
    ]);
  });

  it("renders coordinates and removes credential values", () => {
    const decoded = decodeQqWorksheetPayload(syntheticSheet(), "测试表");
    const markdown = renderQqSheetMarkdown(decoded, 1, 4256);
    expect(markdown).toContain("**A1**：标题");
    expect(markdown).toContain("**B2**：普通内容");
    expect(markdown).toContain("密码：[已安全省略]");
    expect(markdown).not.toContain("not-a-real-secret");
    expect(markdown).toContain("LCJ Brain内部知识库");
    expect(markdown).not.toContain("docs.qq.com/sheet");
  });

  it("stores a structured internal sheet without the credential value", () => {
    const decoded = decodeQqWorksheetPayload(syntheticSheet(), "测试表");
    const snapshot = buildLcfInternalSheetSnapshot(decoded, 1, 4256);
    expect(snapshot.kind).toBe("lcj-internal-sheet");
    expect(snapshot.version).toBe(3);
    expect(snapshot.cells).toHaveLength(3);
    expect(snapshot.cells[2]).toMatchObject({
      coordinate: "B2",
      text: "普通内容",
    });
    expect(JSON.stringify(snapshot)).toContain("[已安全省略]");
    expect(JSON.stringify(snapshot)).not.toContain("not-a-real-secret");
  });

  it("keeps every workbook image beside its original sheet cell", () => {
    const imageUrl = "https://docimg1.docs.qq.com/example-a";
    const fallbackUrl = "https://docimg2.docs.qq.com/example-b";
    const asset = {
      storageKey:
        "private/lcj-brain/lcf-20260908/images/123e4567-e89b-42d3-a456-426614174000.webp",
      name: "image",
      mimeType: "image/webp",
      byteSize: 2048,
      sha256: "a".repeat(64),
    };
    const positioned = buildPositionedSheetImages(
      {
        id: "sheet-photo",
        name: "物料清单",
        maxRow: 20,
        maxCol: 8,
        cells: [
          { row: 4, col: 7, text: "", urls: [imageUrl] },
          { row: 5, col: 7, text: "", urls: [imageUrl] },
        ],
        urls: [imageUrl, fallbackUrl],
      },
      new Map([
        [imageUrl, asset],
        [fallbackUrl, { ...asset, sha256: "b".repeat(64) }],
      ])
    );
    expect(positioned).toHaveLength(3);
    expect(positioned[0]).toMatchObject({ row: 4, col: 7, coordinate: "G4" });
    expect(positioned[1]).toMatchObject({ row: 5, col: 7, coordinate: "G5" });
    expect(positioned[2]).not.toHaveProperty("coordinate");
    expect(positioned[0].sourceUrlSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(positioned)).not.toContain(imageUrl);
  });

  it("uses the same one-based column labels for table headers and image coordinates", () => {
    expect(spreadsheetColumnName(1)).toBe("A");
    expect(spreadsheetColumnName(7)).toBe("G");
    expect(spreadsheetColumnName(26)).toBe("Z");
    expect(spreadsheetColumnName(27)).toBe("AA");
  });

  it("requires all 69 positioned references across 4 sheets and 66 unique images", () => {
    const distributions = [8, 35, 24, 2];
    let imageIndex = 0;
    const rows = Array.from({ length: 36 }, (_, sourceIndex) => {
      const imageCount = distributions[sourceIndex] || 0;
      const images = Array.from({ length: imageCount }, (_, localIndex) => {
        const uniqueIndex = imageIndex++ % 66;
        const row = localIndex + 1;
        const col = (localIndex % 8) + 1;
        return {
          storageKey: `private/lcj-brain/lcf-20260908/images/${uniqueIndex.toString(16).padStart(64, "0")}.webp`,
          name: `image-${imageIndex}`,
          mimeType: "image/webp",
          byteSize: 2048,
          sha256: uniqueIndex.toString(16).padStart(64, "0"),
          row,
          col,
          coordinate: `${spreadsheetColumnName(col)}${row}`,
        };
      });
      return {
        sourceUrl: null,
        structuredContent: JSON.stringify({
          kind: "lcj-internal-sheet",
          version: 3,
          images,
        }),
      };
    });
    const summary = summarizeLcfInternalSources(rows);
    expect(summary).toMatchObject({
      sourceCount: 36,
      internalSourceCount: 36,
      positionedSourceCount: 36,
      imageAssetCount: 69,
      positionedImageCount: 69,
      positionedImageSheetCount: 4,
      uniqueImageAssetCount: 66,
    });
    const baseHealth = {
      projectId: 1,
      projectStatus: "archived",
      ...summary,
      knowledgeCount: 37,
      sopCount: 1,
      templateCount: 1,
    };
    expect(isLcfFirstEditionSeedHealthy(baseHealth)).toBe(true);
    expect(
      isLcfFirstEditionSeedHealthy({
        ...baseHealth,
        positionedImageCount: 68,
      })
    ).toBe(false);
    expect(
      isLcfFirstEditionSeedHealthy({
        ...baseHealth,
        uniqueImageAssetCount: 65,
      })
    ).toBe(false);
  });

  it("binds the final SOP to all 36 source ids", () => {
    const names = expectedLcfSheetNames();
    expect(names).toHaveLength(36);
    const ids = new Map<string, number>();
    const source = readFileSync(
      new URL("./lcfFirstEditionProjectSeed.ts", import.meta.url),
      "utf8"
    );
    const matches = [...source.matchAll(/^\s*\["([^"]+)",\s*"[^"]+"\],$/gm)];
    for (const [index, match] of matches.slice(0, 36).entries())
      ids.set(match[1], index + 1);
    expect(ids.size).toBe(36);
    const sop = buildLcfFirstEditionSopContent(ids);
    expect(sop.sourceIndex).toHaveLength(36);
    expect(sop.scope.sourceRefs).toHaveLength(36);
    expect(sop.title).toContain("LCF 1回目");
  });

  it("starts the idempotent seed after listen and exposes only aggregate health", () => {
    const startup = readFileSync(
      new URL("./_core/index.ts", import.meta.url),
      "utf8"
    );
    expect(startup).toContain("void ensureLcfFirstEditionProjectSeed()");
    expect(startup).toContain('app.get("/api/health/lcf-first-edition"');
    expect(startup).toContain("sourceCount: health.sourceCount");
    expect(startup).toContain(
      "internalSourceCount: health.internalSourceCount"
    );
    expect(startup).toContain(
      "positionedSourceCount: health.positionedSourceCount"
    );
    expect(startup).toContain(
      "positionedImageCount: health.positionedImageCount"
    );
    expect(startup).toContain(
      "positionedImageSheetCount: health.positionedImageSheetCount"
    );
    expect(startup).toContain(
      "uniqueImageAssetCount: health.uniqueImageAssetCount"
    );
    expect(startup).toContain("imageAssetCount: health.imageAssetCount");
    expect(startup).toContain("knowledgeCount: health.knowledgeCount");
    expect(startup).not.toContain("qqRevision: health");
  });
});
