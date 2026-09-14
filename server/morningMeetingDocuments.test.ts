import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Document, Packer, Paragraph } from "docx";
import {
  MORNING_MEETING_DOCUMENT_MAX_BYTES,
  MORNING_MEETING_DOCUMENT_MAX_EXTRACTED_CHARS,
  parseMorningMeetingDocumentFile,
  resolveXlsxCfbFacade,
} from "./morningMeetingDocumentParser";
import { isMorningMeetingDocumentTeamAllowed } from "./morningMeetingDocumentService";

const temporaryDirectories: string[] = [];

async function temporaryFile(name: string, content: Buffer | string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "lcj-morning-document-test-"));
  temporaryDirectories.push(directory);
  const path = join(directory, name);
  await writeFile(path, content);
  return path;
}

function advertiseOversizedDocumentXml(source: Buffer): Buffer {
  const buffer = Buffer.from(source);
  for (let offset = 0; offset + 46 <= buffer.length; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const entryEnd = offset + 46 + fileNameLength + extraLength + commentLength;
    if (entryEnd > buffer.length) break;
    const entryName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8").replaceAll("\\", "/").toLowerCase();
    if (entryName === "word/document.xml" || entryName.endsWith("/word/document.xml")) {
      buffer.writeUInt32LE(9 * 1024 * 1024, offset + 24);
      return buffer;
    }
    offset = entryEnd - 1;
  }
  throw new Error("synthetic DOCX did not contain word/document.xml");
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("morning meeting document parser", () => {
  it("resolves both ESM and production CommonJS xlsx CFB exports", () => {
    const cfb = {
      read: () => ({ FullPaths: [] }),
      find: () => null,
    };
    expect(resolveXlsxCfbFacade({ CFB: cfb })).toBe(cfb);
    expect(resolveXlsxCfbFacade({ default: { CFB: cfb } })).toBe(cfb);
    expect(() => resolveXlsxCfbFacade({})).toThrow("MORNING_DOCUMENT_DOCX_ENGINE_UNAVAILABLE");
  });

  it("extracts text from a synthetic DOCX without using user files", async () => {
    const document = new Document({
      sections: [{
        children: [
          new Paragraph("Morning meeting agenda"),
          new Paragraph("Owner confirms the next action."),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(document);
    const path = await temporaryFile("agenda.docx", buffer);
    const parsed = await parseMorningMeetingDocumentFile({
      filePath: path,
      originalName: "agenda.docx",
      declaredSize: buffer.length,
    });

    expect(parsed.kind).toBe("docx");
    expect(parsed.mimeType).toContain("wordprocessingml.document");
    expect(parsed.extractedText).toContain("Morning meeting agenda");
    expect(parsed.extractedText).toContain("Owner confirms the next action.");
    expect(parsed.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.textTruncated).toBe(false);
  });

  it("rejects a DOCX whose advertised XML expansion exceeds the safe limit", async () => {
    const document = new Document({
      sections: [{ children: [new Paragraph("Synthetic safe text")] }],
    });
    const malicious = advertiseOversizedDocumentXml(await Packer.toBuffer(document));
    const path = await temporaryFile("oversized.docx", malicious);
    await expect(parseMorningMeetingDocumentFile({
      filePath: path,
      originalName: "oversized.docx",
      declaredSize: malicious.length,
    })).rejects.toThrow("MORNING_DOCUMENT_DOCX_TEXT_TOO_LARGE");
  });

  it("keeps the full source file while limiting only the preview text", async () => {
    const content = "A".repeat(MORNING_MEETING_DOCUMENT_MAX_EXTRACTED_CHARS + 500);
    const path = await temporaryFile("notes.txt", content);
    const parsed = await parseMorningMeetingDocumentFile({
      filePath: path,
      originalName: "notes.txt",
      declaredSize: Buffer.byteLength(content),
    });

    expect(parsed.fileSize).toBe(Buffer.byteLength(content));
    expect(parsed.extractedChars).toBe(content.length);
    expect(parsed.extractedText).toHaveLength(MORNING_MEETING_DOCUMENT_MAX_EXTRACTED_CHARS);
    expect(parsed.textTruncated).toBe(true);
  });

  it("rejects a fake DOCX whose extension does not match its signature", async () => {
    const content = Buffer.from("not a zip document", "utf8");
    const path = await temporaryFile("fake.docx", content);
    await expect(parseMorningMeetingDocumentFile({
      filePath: path,
      originalName: "fake.docx",
      declaredSize: content.length,
    })).rejects.toThrow("MORNING_DOCUMENT_SIGNATURE_MISMATCH");
  });

  it("rejects unsupported extensions and binary text", async () => {
    const unsupported = await temporaryFile("agenda.exe", "unsafe");
    await expect(parseMorningMeetingDocumentFile({
      filePath: unsupported,
      originalName: "agenda.exe",
    })).rejects.toThrow("MORNING_DOCUMENT_UNSUPPORTED_FORMAT");

    const binary = await temporaryFile("agenda.txt", Buffer.from([0x41, 0x00, 0x42]));
    await expect(parseMorningMeetingDocumentFile({
      filePath: binary,
      originalName: "agenda.txt",
    })).rejects.toThrow("MORNING_DOCUMENT_TEXT_INVALID");
  });

  it("uses explicit document size limits", () => {
    expect(MORNING_MEETING_DOCUMENT_MAX_BYTES).toBe(20 * 1024 * 1024);
    expect(MORNING_MEETING_DOCUMENT_MAX_EXTRACTED_CHARS).toBe(60_000);
  });
});

describe("morning meeting document authorization", () => {
  it("allows admins to both teams and staff only to their own team", () => {
    expect(isMorningMeetingDocumentTeamAllowed("admin", null, "china")).toBe(true);
    expect(isMorningMeetingDocumentTeamAllowed("admin", null, "japan")).toBe(true);
    expect(isMorningMeetingDocumentTeamAllowed("user", "china", "china")).toBe(true);
    expect(isMorningMeetingDocumentTeamAllowed("user", "china", "japan")).toBe(false);
    expect(isMorningMeetingDocumentTeamAllowed("user", null, "china")).toBe(false);
  });
});

describe("morning meeting document source contracts", () => {
  it("authenticates and checks team access before parsing multipart content", async () => {
    const source = await readFile(new URL("./_core/index.ts", import.meta.url), "utf8");
    const routeStart = source.indexOf('"/api/morning-meeting/document-upload"');
    const routeEnd = source.indexOf('app.post("/api/upload-voice"', routeStart);
    const route = source.slice(routeStart, routeEnd);
    expect(routeStart).toBeGreaterThan(0);
    expect(route.indexOf("sdk.authenticateRequest(req)")).toBeGreaterThan(0);
    expect(route.indexOf("requireMorningMeetingDocumentTeamAccess")).toBeGreaterThan(route.indexOf("sdk.authenticateRequest(req)"));
    expect(route.indexOf('morningMeetingDocumentUpload.single("file")')).toBeGreaterThan(route.indexOf("requireMorningMeetingDocumentTeamAccess"));
    expect(source).toContain("fileSize: 20 * 1024 * 1024");
    expect(route).toContain("storagePutFile");
    expect(route).toContain("storageDelete");
    expect(route).not.toContain("extractedText });");
  });

  it("stores documents independently and never updates transcript, summary or meeting status", async () => {
    const source = await readFile(new URL("./morningMeetingDocumentService.ts", import.meta.url), "utf8");
    expect(source).toContain("morning_meeting_documents");
    expect(source).toContain("UNIQUE KEY unique_morning_meeting_document");
    expect(source).toContain("affectsTranscript: false");
    expect(source).toContain("affectsFormalSummary: false");
    expect(source).not.toContain(".update(morningMeetings)");
    expect(source).not.toMatch(/\btranscript\s*:/);
    expect(source).not.toMatch(/\bsummary\s*:/);
  });

  it("defines duplicate protection and MEDIUMTEXT preview storage in the schema", async () => {
    const schema = await readFile(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    expect(schema).toContain('mysqlTable("morning_meeting_documents"');
    expect(schema).toContain('mediumtext("extractedText")');
    expect(schema).toContain('uniqueIndex("unique_morning_meeting_document")');
  });

  it("exposes preview, download, delete and history without document-to-summary mutation", async () => {
    const router = await readFile(new URL("./morningMeetingRouter.ts", import.meta.url), "utf8");
    const page = await readFile(new URL("../client/src/pages/MorningMeeting.tsx", import.meta.url), "utf8");
    const component = await readFile(new URL("../client/src/components/morningMeeting/MorningMeetingDocuments.tsx", import.meta.url), "utf8");
    expect(router).toContain("getDocuments: protectedProcedure");
    expect(router).toContain("getDocumentPreview: protectedProcedure");
    expect(router).toContain("getDocumentDownloadUrl: protectedProcedure");
    expect(router).toContain("deleteDocument: protectedProcedure");
    expect(page).toContain('["documents", speechLang === "zh-CN" ? "会议资料" : "会議資料"]');
    expect(component).toContain("不会替代录音转写，也不会自动生成正式日报");
    expect(component).toContain(".docx,.pdf,.txt,.md");
    expect(component).not.toContain("saveDailyTeamMeetingMutation.mutate");
  });
});
