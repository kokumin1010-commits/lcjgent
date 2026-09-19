import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  buildLcfFirstEditionSopContent,
  decodeQqWorksheetPayload,
  expectedLcfSheetNames,
  renderQqSheetMarkdown,
} from "./lcfFirstEditionProjectSeed";

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
  });

  it("binds the final SOP to all 36 source ids", () => {
    const names = expectedLcfSheetNames();
    expect(names).toHaveLength(36);
    const ids = new Map<string, number>();
    const source = require("node:fs").readFileSync(
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
});
