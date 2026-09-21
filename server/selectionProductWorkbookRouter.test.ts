import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decode: vi.fn(() => Buffer.from("verified-workbook")),
  preview: vi.fn(async () => ({
    fileSha256: "a".repeat(64),
    sheetName: "LIST_PRODUCT",
    sourceRowCount: 1,
    recognizedHeaders: { productName: "商品名称" },
    rows: [],
    warnings: [],
    capabilities: { hasBrand: false, hasSku: false, hasBarcode: false, hasStock: false },
  })),
  commit: vi.fn(async () => ({ insertedCount: 1, skippedDuplicates: [], insertedIds: [101] })),
  sha256: vi.fn(() => "a".repeat(64)),
}));

vi.mock("./selectionProductWorkbookImport", () => {
  class SelectionProductWorkbookError extends Error {}
  return {
    decodeProductWorkbookBase64: mocks.decode,
    previewSelectionProductWorkbook: mocks.preview,
    importSelectionProductWorkbook: mocks.commit,
    PRODUCT_SHEET_MAX_COMMIT_ROWS: 500,
    SelectionProductWorkbookError,
    selectionProductWorkbookSha256: mocks.sha256,
  };
});

import { selectionCenterRouter } from "./selectionCenterRouter";

function context(user: null | { id: number; role: "user" | "admin" }) {
  return {
    user: user ? {
      id: user.id,
      openId: `sheet-user-${user.id}`,
      email: `sheet-${user.id}@example.invalid`,
      name: "Sheet Import User",
      loginMethod: "test",
      role: user.role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { headers: {} },
    res: {},
  } as any;
}

const fileInput = { fileName: "kalodata.xlsx", base64Data: "dmVyaWZpZWQ=" };

describe("selection product workbook router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated preview and commit before parsing", async () => {
    const caller = selectionCenterRouter.createCaller(context(null));
    await expect(caller.previewProductWorkbook(fileInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.commitProductWorkbook({
      ...fileInput,
      fileSha256: "a".repeat(64),
      selections: [{ rowKey: "id:1", brandName: "品牌" }],
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.decode).not.toHaveBeenCalled();
  });

  it("returns the server-side preview for an authenticated user", async () => {
    const caller = selectionCenterRouter.createCaller(context({ id: 42, role: "user" }));
    const result = await caller.previewProductWorkbook(fileInput);
    expect(result).toMatchObject({ sheetName: "LIST_PRODUCT", fileSha256: "a".repeat(64) });
    expect(mocks.decode).toHaveBeenCalledWith(fileInput.base64Data);
    expect(mocks.preview).toHaveBeenCalledTimes(1);
  });

  it("rejects a changed file hash before database import", async () => {
    mocks.sha256.mockReturnValueOnce("b".repeat(64));
    const caller = selectionCenterRouter.createCaller(context({ id: 42, role: "admin" }));
    await expect(caller.commitProductWorkbook({
      ...fileInput,
      fileSha256: "a".repeat(64),
      selections: [{ rowKey: "id:1", brandName: "品牌" }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("passes only row keys, verified brands, and the authenticated creator to commit", async () => {
    const caller = selectionCenterRouter.createCaller(context({ id: 42, role: "admin" }));
    const selections = [{ rowKey: "id:1", brandName: "KYOGOKU JAPAN" }];
    const result = await caller.commitProductWorkbook({
      ...fileInput,
      fileSha256: "a".repeat(64),
      selections,
    });
    expect(result.insertedCount).toBe(1);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    const [, verifiedBuffer, passedFileName, passedSelections, passedCreator] = mocks.commit.mock.calls[0];
    expect(Buffer.from(verifiedBuffer as Uint8Array).toString("utf8")).toBe("verified-workbook");
    expect(passedFileName).toBe(fileInput.fileName);
    expect(passedSelections).toEqual(selections);
    expect(passedCreator).toBe(42);
  });
});
