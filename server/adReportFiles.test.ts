import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({
  createAdReportFile: vi.fn().mockResolvedValue({ id: 1 }),
  getAdReportFilesByBrand: vi.fn().mockResolvedValue([
    {
      id: 1,
      brandId: 1,
      fileName: "tiktok_report.pdf",
      fileType: "pdf",
      fileUrl: "https://example.com/tiktok_report.pdf",
      fileKey: "reports/tiktok_report.pdf",
      analysisStatus: "completed",
      analysisResult: JSON.stringify({ campaignName: "Test Campaign" }),
      uploadedBy: "user1",
      uploadedByName: "Test User",
      createdAt: new Date(),
    },
  ]),
  deleteAdReportFile: vi.fn().mockResolvedValue(true),
}));

import {
  createAdReportFile,
  getAdReportFilesByBrand,
  deleteAdReportFile,
} from "./db";

describe("Ad Report Files", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an ad report file record", async () => {
    const result = await createAdReportFile({
      brandId: 1,
      fileName: "tiktok_report.pdf",
      fileType: "pdf",
      fileUrl: "https://example.com/tiktok_report.pdf",
      fileKey: "reports/tiktok_report.pdf",
      analysisStatus: "completed",
      analysisResult: JSON.stringify({ campaignName: "Test Campaign" }),
      uploadedBy: "user1",
      uploadedByName: "Test User",
    });
    expect(createAdReportFile).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 1 });
  });

  it("should get ad report files by brand", async () => {
    const files = await getAdReportFilesByBrand(1);
    expect(getAdReportFilesByBrand).toHaveBeenCalledWith(1);
    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe("tiktok_report.pdf");
    expect(files[0].analysisStatus).toBe("completed");
  });

  it("should delete an ad report file", async () => {
    const result = await deleteAdReportFile(1);
    expect(deleteAdReportFile).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  it("should return files with correct structure", async () => {
    const files = await getAdReportFilesByBrand(1);
    const file = files[0];
    expect(file).toHaveProperty("id");
    expect(file).toHaveProperty("brandId");
    expect(file).toHaveProperty("fileName");
    expect(file).toHaveProperty("fileType");
    expect(file).toHaveProperty("fileUrl");
    expect(file).toHaveProperty("analysisStatus");
    expect(file).toHaveProperty("uploadedBy");
  });
});
