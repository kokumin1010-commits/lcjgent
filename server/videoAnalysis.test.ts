import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://example.com/test.jpg", key: "test.jpg" }),
}));

// Mock the voice transcription module
vi.mock("./_core/voiceTranscription", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: "これはテスト音声です",
    language: "ja",
    duration: 10.5,
    task: "transcribe",
    segments: [],
  }),
}));

describe("Video Analysis Module", () => {
  describe("Module Import", () => {
    it("should import videoAnalysis module successfully", async () => {
      const videoAnalysisModule = await import("./videoAnalysis");
      expect(videoAnalysisModule).toBeDefined();
      expect(videoAnalysisModule.analyzeVideoContent).toBeDefined();
      expect(videoAnalysisModule.generateVideoAnalysisPrompt).toBeDefined();
    });
  });

  describe("generateVideoAnalysisPrompt", () => {
    it("should generate prompt with transcription and frames", async () => {
      const { generateVideoAnalysisPrompt } = await import("./videoAnalysis");
      
      const result = {
        transcription: "テスト音声の内容です",
        transcriptionLanguage: "ja",
        transcriptionDuration: 15.5,
        frames: [
          { timestamp: 1, position: "start" as const, url: "https://example.com/frame1.jpg" },
          { timestamp: 7.5, position: "middle" as const, url: "https://example.com/frame2.jpg" },
          { timestamp: 14, position: "end" as const, url: "https://example.com/frame3.jpg" },
        ],
        videoDuration: 15,
      };
      
      const prompt = generateVideoAnalysisPrompt(result);
      
      expect(prompt).toContain("動画コンテンツ分析");
      expect(prompt).toContain("15.0秒");
      expect(prompt).toContain("テスト音声の内容です");
      expect(prompt).toContain("3枚");
      expect(prompt).toContain("start");
      expect(prompt).toContain("middle");
      expect(prompt).toContain("end");
    });

    it("should handle missing transcription", async () => {
      const { generateVideoAnalysisPrompt } = await import("./videoAnalysis");
      
      const result = {
        frames: [
          { timestamp: 5, position: "middle" as const, url: "https://example.com/frame.jpg" },
        ],
        videoDuration: 10,
      };
      
      const prompt = generateVideoAnalysisPrompt(result);
      
      expect(prompt).toContain("動画コンテンツ分析");
      expect(prompt).toContain("音声なし");
      expect(prompt).toContain("1枚");
    });

    it("should handle empty frames", async () => {
      const { generateVideoAnalysisPrompt } = await import("./videoAnalysis");
      
      const result = {
        transcription: "音声のみ",
        frames: [],
        videoDuration: 5,
      };
      
      const prompt = generateVideoAnalysisPrompt(result);
      
      expect(prompt).toContain("音声のみ");
      expect(prompt).not.toContain("抽出されたフレーム");
    });
  });
});

describe("LINE Content API", () => {
  describe("getMessageContent", () => {
    it("should be exported from line module", async () => {
      const lineModule = await import("./line");
      expect(lineModule.getMessageContent).toBeDefined();
      expect(typeof lineModule.getMessageContent).toBe("function");
    });
  });

  describe("getTranscodingStatus", () => {
    it("should be exported from line module", async () => {
      const lineModule = await import("./line");
      expect(lineModule.getTranscodingStatus).toBeDefined();
      expect(typeof lineModule.getTranscodingStatus).toBe("function");
    });
  });

  describe("getContentPreview", () => {
    it("should be exported from line module", async () => {
      const lineModule = await import("./line");
      expect(lineModule.getContentPreview).toBeDefined();
      expect(typeof lineModule.getContentPreview).toBe("function");
    });
  });
});

describe("LINE Agent Video Processing", () => {
  describe("processVideoMessage", () => {
    it("should be exported from lineAgent module", async () => {
      const lineAgentModule = await import("./lineAgent");
      expect(lineAgentModule.processVideoMessage).toBeDefined();
      expect(typeof lineAgentModule.processVideoMessage).toBe("function");
    });
  });

  describe("processLineMessageAll", () => {
    it("should be exported from lineAgent module", async () => {
      const lineAgentModule = await import("./lineAgent");
      expect(lineAgentModule.processLineMessageAll).toBeDefined();
      expect(typeof lineAgentModule.processLineMessageAll).toBe("function");
    });
  });
});
