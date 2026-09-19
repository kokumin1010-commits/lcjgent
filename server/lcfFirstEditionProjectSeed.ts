import crypto from "node:crypto";
import zlib from "node:zlib";
import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import {
  attachSopGenerationMetadata,
  buildReusableSopTemplateContent,
  sopContentToMarkdown,
} from "../shared/lcjBrainProjectSop";
import { ensureLcjBrainProjectUpgrade } from "./lcjBrainProjectUpgrade";

const DOCUMENT_ID = "DTmJvdGZ0dVZrV3Fv";
const SOURCE_URL = `https://docs.qq.com/sheet/${DOCUMENT_ID}`;
const PROJECT_CODE = "LCF-20260908-FIRST-KNOWHOW";
const SOURCE_PREFIX = "note:qq-lcf-2026-09-first:sheet:";
const SOP_PROMPT_VERSION = "qq-lcf-20260908-evidence-v1";
const TEMPLATE_CODE = "TPL-LCF-20260908-FIRST-R1";
const LOCK_NAME = "lcj_brain_lcf_first_edition_seed_v1";
const EXPECTED_SHEET_COUNT = 36;
const EXPECTED_VISIBLE_VALUE_MINIMUM = 7_900;
const EVENT_OCCURRED_AT = "2026-09-09 23:59:59";
const SYSTEM_NAME = "LCJ Brain QQ Import";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const MAX_INFLATED_BYTES = 32 * 1024 * 1024;

export const LCF_FIRST_EDITION_PROJECT_CODE = PROJECT_CODE;
export const LCF_FIRST_EDITION_SOURCE_COUNT = EXPECTED_SHEET_COUNT;

const EXPECTED_SHEETS = [
  ["000001", "運営体制表"],
  ["000021", "整体进度管理"],
  ["mme4ia", "展位图"],
  ["00002a", "展会物料"],
  ["36v5gy", "物料总表"],
  ["m64r81", "物料清单"],
  ["qpkpow", "资料讯息汇总"],
  ["slepxz", "宣发进度"],
  ["lgfda3", "Q&A"],
  ["000003", "意向品牌进度"],
  ["000006", "展会品牌跟进表"],
  ["6or95w", "现场兼职工作分配"],
  ["u2fxd5", "工作表2"],
  ["5f3oda", "达人邀约进度"],
  ["000007", "达播品牌跟进表"],
  ["000008", "展会物流情况"],
  ["000009", "签证问题"],
  ["00000a", "论坛流程"],
  ["00000b", "奖杯"],
  ["000022", "DAY1_9月8日"],
  ["000024", "DAY2_9月9日"],
  ["0ner0h", "摄影"],
  ["9qfooe", "明星路线图"],
  ["lij66e", "（艺人、主播）后台、休息室"],
  ["023zy8", "停车位预留"],
  ["s4hi2i", "通行动线规划"],
  ["000023", "KG品牌日・主播直播排班"],
  ["000025", "人员配置"],
  ["000026", "会场・制作物管理"],
  ["000027", "出演者・登坛嘉宾对应-9.8"],
  ["000028", "出演者・登坛嘉宾对应-9.9"],
  ["000029", "当天检查清单"],
  ["00002b", "签到・Check-in流程"],
  ["00002c", "物料Check List"],
  ["d8h1dy", "工作表1"],
  ["n7dmbn", "兼职待面试表"],
] as const;

const EXPECTED_NAME_BY_ID = new Map<string, string>(EXPECTED_SHEETS);
const SOURCE_SUMMARIES: Record<string, string> = {
  "000001": "运营板块、前置责任、直播与摄影分工。",
  "000021": "整体时序、状态、责任与执行控制。",
  mme4ia: "5F／6F展位、赞助位及部分品牌配置。",
  "00002a": "会场制作物、物料、期限与责任。",
  "36v5gy": "物料优先级、制作、现场确认、状态与备注。",
  m64r81: "物料数量、规格、到货及状态快照。",
  qpkpow: "资料入口、话术、素材目录与展位预留规则；凭据已脱敏。",
  slepxz: "宣发节奏、日期化计划与完成状态。",
  lgfda3: "品牌墙面、LED、停车、晚宴等问答与待决项。",
  "000003": "品牌意向、跟进状态与个别合作条件。",
  "000006": "出展条目、合同／手引及品牌级字段。",
  "6or95w": "分楼层、分区域兼职岗位和异常升级安排。",
  u2fxd5: "展位、赞助类别、直播区域与画面规格参考。",
  "5f3oda": "达人邀约、报名、视频与跟进状态。",
  "000007": "达播品牌的商务、内容、后台与现场交接字段。",
  "000008": "品牌物流登记字段；现有记录主要为表头。",
  "000009": "签证与返程相关登记。",
  "00000a": "论坛流程字段；具体议程记录有限。",
  "00000b": "奖项、授賞者与纪念品映射。",
  "000022": "DAY1计划性时间线与Rundown。",
  "000024": "DAY2计划性时间线与Rundown。",
  "0ner0h": "摄影工作表；现有记录有限。",
  "9qfooe": "明星路线工作表；现有记录仅为标题字段。",
  lij66e: "艺人／主播后台、休息室、餐食与过敏原事项。",
  "023zy8": "艺人团队停车位预留需求。",
  s4hi2i: "通行动线规划工作表；现有记录有限。",
  "000023": "两日Brand Day主播×品牌×展位×时间排班。",
  "000025": "工作人员A–O暂定分工、时段与对讲机需求。",
  "000026": "会场、制作物与当日安排。",
  "000027": "DAY1出演嘉宾接待、休息室及上台动线。",
  "000028": "DAY2登坛嘉宾、资料与到达确认。",
  "000029": "DAY1／DAY2逐项检查与确认状态。",
  "00002b": "5F三通道、QR核销、入场与异常升级规则。",
  "00002c": "物料验收、9/7测试、使用与撤场检查。",
  d8h1dy: "去重后的物料准备清单。",
  n7dmbn: "兼职候选人基础记录；联系方式已脱敏。",
};

type WireNode = {
  field: number;
  wire: number;
  value?: bigint;
  raw?: Buffer;
  text?: string;
  children?: WireNode[];
};

type QqHeader = {
  id: string;
  name: string;
  hidden?: boolean;
  type?: string;
};

type QqSession = {
  headers: QqHeader[];
  globalPadId: string;
  rev: number;
};

export type DecodedQqCell = {
  row: number;
  col: number;
  text: string;
  urls: string[];
};

export type DecodedQqSheet = {
  id: string;
  name: string;
  maxRow: number;
  maxCol: number;
  cells: DecodedQqCell[];
  urls: string[];
};

type SeedHealth = {
  projectId: number | null;
  sourceCount: number;
  sopCount: number;
  templateCount: number;
};

let seedPromise: Promise<void> | null = null;

function readVarint(buffer: Buffer, start: number) {
  let value = 0n;
  let shift = 0n;
  let position = start;
  while (position < buffer.length && shift < 70n) {
    const byte = buffer[position++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return { value, position };
    shift += 7n;
  }
  throw new Error(`invalid QQ protobuf varint at ${start}`);
}

function printableUtf8(buffer: Buffer): string | undefined {
  const text = buffer.toString("utf8");
  if (!text || text.includes("�")) return undefined;
  const characters = [...text];
  const printable = characters.filter(character => {
    const codePoint = character.codePointAt(0) || 0;
    return (
      codePoint === 9 || codePoint === 10 || codePoint === 13 || codePoint >= 32
    );
  }).length;
  return printable / Math.max(1, characters.length) > 0.92 ? text : undefined;
}

function parseWireMessage(buffer: Buffer, depth = 0): WireNode[] {
  const nodes: WireNode[] = [];
  let position = 0;
  while (position < buffer.length) {
    const start = position;
    const tag = readVarint(buffer, position);
    position = tag.position;
    const field = Number(tag.value >> 3n);
    const wire = Number(tag.value & 7n);
    if (!field || wire === 3 || wire === 4 || wire > 5)
      throw new Error(`unsupported QQ protobuf tag ${tag.value} at ${start}`);
    const node: WireNode = { field, wire };
    if (wire === 0) {
      const result = readVarint(buffer, position);
      position = result.position;
      node.value = result.value;
    } else if (wire === 1) {
      if (position + 8 > buffer.length)
        throw new Error("QQ protobuf fixed64 overflow");
      node.raw = buffer.subarray(position, position + 8);
      position += 8;
    } else if (wire === 2) {
      const lengthResult = readVarint(buffer, position);
      position = lengthResult.position;
      const length = Number(lengthResult.value);
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        position + length > buffer.length
      )
        throw new Error("QQ protobuf length overflow");
      node.raw = buffer.subarray(position, position + length);
      position += length;
      node.text = printableUtf8(node.raw);
      if (depth < 12 && length) {
        try {
          node.children = parseWireMessage(node.raw, depth + 1);
        } catch {
          // Scalar bytes frequently resemble a protobuf prefix; they are intentionally left opaque.
        }
      }
    } else if (wire === 5) {
      if (position + 4 > buffer.length)
        throw new Error("QQ protobuf fixed32 overflow");
      node.raw = buffer.subarray(position, position + 4);
      position += 4;
    }
    nodes.push(node);
  }
  return nodes;
}

const childNodes = (node: WireNode | undefined, field: number) =>
  (node?.children || []).filter(child => child.field === field);
const firstChild = (node: WireNode | undefined, field: number) =>
  childNodes(node, field)[0];
const childVarint = (node: WireNode | undefined, field: number, fallback = 0) =>
  Number(firstChild(node, field)?.value ?? BigInt(fallback));

function cleanRichText(value: string): string {
  if (!value) return "";
  if (value.startsWith("\n") && value.length > 1) {
    const second = value.codePointAt(1) || 0;
    if (second < 32) return value.slice(2);
  }
  return value;
}

function sharedString(entry: WireNode): string {
  const direct = firstChild(entry, 1);
  if (!direct) return "";
  if (typeof direct.text === "string") return cleanRichText(direct.text);
  const nested = firstChild(direct, 1);
  return cleanRichText(nested?.text || nested?.raw?.toString("utf8") || "");
}

function richString(entry: WireNode): string {
  return childNodes(entry, 3)
    .map(run => {
      const valueWrapper = firstChild(run, 3);
      const textNode = firstChild(valueWrapper, 1);
      return cleanRichText(textNode?.text || "");
    })
    .join("");
}

function decodeDouble(raw: Buffer | undefined): string {
  if (!raw) return "";
  if (raw.length === 8) return String(raw.readDoubleLE(0));
  if (raw.length === 4) return String(raw.readFloatLE(0));
  return "";
}

function findWorksheet(root: WireNode[]): WireNode {
  const envelope = firstChild({ field: 0, wire: 2, children: root }, 1);
  if (!envelope) throw new Error("QQ workbook envelope missing");
  for (const section of childNodes(envelope, 5)) {
    if (childVarint(section, 1, -1) !== 18) continue;
    const worksheet = firstChild(section, 19);
    if (worksheet) return worksheet;
  }
  throw new Error("QQ worksheet section missing");
}

function collectUrls(nodes: WireNode[]): string[] {
  const urls = new Set<string>();
  const visit = (node: WireNode) => {
    if (node.text) {
      for (const match of node.text.matchAll(
        /https?:\/\/[^\s<>"'\\\u0000-\u001f]+/g
      )) {
        urls.add(match[0].replace(/[),.;]+$/, ""));
      }
    }
    for (const child of node.children || []) visit(child);
  };
  for (const node of nodes) visit(node);
  return [...urls].sort();
}

function numberFromPayload(
  payload: WireNode,
  numberDictionary: string[]
): string {
  const valueNode = firstChild(payload, 2);
  if (
    !valueNode?.raw?.length &&
    !valueNode?.children?.length &&
    valueNode?.value === undefined
  )
    return "0";
  const nested = valueNode.children?.find(
    node => node.raw || node.value !== undefined
  );
  if (nested?.value !== undefined) {
    const token = Number(nested.value);
    return token >= 129 && numberDictionary[token - 129] !== undefined
      ? numberDictionary[token - 129]
      : String(token);
  }
  if (nested?.raw) return decodeDouble(nested.raw);
  if (valueNode.value !== undefined) return String(valueNode.value);
  if (valueNode.raw?.length) return decodeDouble(valueNode.raw);
  return "0";
}

function qqInitialPayload(json: any): any {
  return (
    json?.clientVars?.collab_client_vars?.initialAttributedText ||
    json?.data?.initialAttributedText
  )?.text?.[0];
}

export function decodeQqWorksheetPayload(
  json: unknown,
  expectedName = ""
): DecodedQqSheet {
  const initial = qqInitialPayload(json);
  const relatedSheets = [
    initial?.related_sheet,
    ...(Array.isArray(initial?.block_datas)
      ? initial.block_datas.map((block: any) => block?.related_sheet)
      : []),
  ].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );
  if (!relatedSheets.length)
    throw new Error("QQ related_sheet payload missing");

  const decodedBuffers = relatedSheets.map(value => {
    const compressed = Buffer.from(value, "base64");
    if (compressed.length > MAX_RESPONSE_BYTES)
      throw new Error("QQ compressed sheet exceeds limit");
    return zlib.inflateSync(compressed, {
      maxOutputLength: MAX_INFLATED_BYTES,
    });
  });
  const parsedRoots = decodedBuffers.map(buffer => parseWireMessage(buffer));
  const worksheet = findWorksheet(parsedRoots[0]);
  const metadata = firstChild(worksheet, 3);
  const idNode = firstChild(metadata, 1);
  const id = idNode?.text || idNode?.raw?.toString("utf8") || "";
  const dictionaryNode = firstChild(worksheet, 5);
  const dictionary = childNodes(dictionaryNode, 1).map(sharedString);
  const richDictionary = childNodes(dictionaryNode, 2).map(richString);
  const numberDictionary = childNodes(dictionaryNode, 3).map(entry =>
    decodeDouble(firstChild(entry, 1)?.raw)
  );

  const cells = new Map<string, DecodedQqCell>();
  for (const root of parsedRoots) {
    const blockWorksheet = findWorksheet(root);
    for (const record of childNodes(blockWorksheet, 6)) {
      const row = childVarint(record, 1, 0) + 1;
      const col = childVarint(record, 2, 0) + 1;
      const payload = firstChild(record, 3);
      if (!payload) continue;
      const type = childVarint(payload, 1, 0);
      let text = "";
      if (type === 4) {
        const index = childVarint(firstChild(payload, 2), 1, 0);
        text = dictionary[index] || "";
      } else if (type === 6) {
        const index = childVarint(firstChild(payload, 2), 1, 0);
        text = richDictionary[index] || "";
      } else if (type === 2 || type === 3) {
        text = numberFromPayload(payload, numberDictionary);
      }
      const urls = collectUrls([payload]);
      if (!text.trim() && !urls.length) continue;
      cells.set(`${row}:${col}`, { row, col, text: text.trim(), urls });
    }
  }

  return {
    id,
    name: expectedName,
    maxRow: Number(initial?.max_row || 0),
    maxCol: Number(initial?.max_col || 0),
    cells: [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col),
    urls: [...new Set(parsedRoots.flatMap(collectUrls))].sort(),
  };
}

function columnName(column: number): string {
  let value = column;
  let output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output || "A";
}

function redactSensitiveText(
  text: string,
  sheetId: string,
  row: number,
  col: number
): string {
  if (sheetId === "qpkpow" && row === 10 && col === 3)
    return "[云盘账号与密码已安全省略]";
  if (sheetId === "n7dmbn" && row === 2 && (col === 5 || col === 6))
    return "[候选人联系方式已安全省略]";

  return text
    .replace(
      /((?:密码|密碼|パスワード|password|secret|api\s*key|token)\s*[:：]\s*)[^\n\r]+/gi,
      "$1[已安全省略]"
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已省略]")
    .replace(/(?<![\w/])(?:\+?\d[\d\s().-]{8,}\d)(?![\w/])/g, candidate =>
      candidate.replace(/\D/g, "").length >= 10 ? "[电话号码已省略]" : candidate
    );
}

function readableNumeric(value: string): string {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    !Number.isInteger(number) ||
    number < 30_000 ||
    number > 60_000
  )
    return value;
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + number * 86_400_000);
  return `${date.toISOString().slice(0, 10)}（QQ底层日期值：${value}）`;
}

export function renderQqSheetMarkdown(
  sheet: DecodedQqSheet,
  index: number,
  revision: number
): string {
  const sourceUrl = `${SOURCE_URL}?tab=${sheet.id}`;
  const rows = new Map<number, DecodedQqCell[]>();
  for (const cell of sheet.cells) {
    const existing = rows.get(cell.row) || [];
    existing.push(cell);
    rows.set(cell.row, existing);
  }
  const lines = [
    `# 工作表 ${String(index).padStart(2, "0")}：${sheet.name}`,
    "",
    `- 原始工作表：[${sheet.name}](${sourceUrl})`,
    `- 工作表ID：\`${sheet.id}\``,
    `- QQ版本：\`${revision}\`（首次导入快照）`,
    `- 原始范围：${sheet.maxRow || "未提供"} 行 × ${sheet.maxCol || "未提供"} 列`,
    `- 保留显示值：${sheet.cells.length} 个`,
    "- 安全处理：密码、密钥、邮箱、电话号码等直接凭据／联系方式不复制到LCJ Brain。",
  ];

  if (!sheet.cells.length) {
    lines.push("", "> 当前快照没有可读单元格值；不以一般知识补写。");
  } else {
    for (const [row, cells] of [...rows.entries()].sort(
      (a, b) => a[0] - b[0]
    )) {
      lines.push("", `## 行 ${row}`, "");
      for (const cell of cells.sort((a, b) => a.col - b.col)) {
        const raw = redactSensitiveText(
          cell.text,
          sheet.id,
          cell.row,
          cell.col
        );
        const value = readableNumeric(raw).replace(/\r?\n/g, "\n  ");
        lines.push(
          `- **${columnName(cell.col)}${cell.row}**：${value || "（空白）"}`
        );
        for (const url of cell.urls)
          if (!raw.includes(url)) lines.push(`  - 参照：${url}`);
      }
    }
  }

  const renderedText = lines.join("\n");
  const externalUrls = sheet.urls.filter(url => !renderedText.includes(url));
  if (externalUrls.length) {
    lines.push("", "## 图片／附件／链接引用", "");
    externalUrls.forEach(url => lines.push(`- ${url}`));
  }
  return lines.join("\n").trim();
}

async function fetchJson(url: string, referer: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      Referer: referer,
      "User-Agent": "Mozilla/5.0 LCJ-Brain-Import/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`QQ request failed with HTTP ${response.status}`);
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES)
    throw new Error("QQ JSON response exceeds limit");
  const json = JSON.parse(text);
  if (json?.retcode !== undefined && Number(json.retcode) !== 0)
    throw new Error(`QQ API retcode ${json.retcode}`);
  return json;
}

async function openWorkbook(): Promise<QqSession> {
  const query = new URLSearchParams({
    outformat: "1",
    normal: "1",
    preview_token: "",
    id: DOCUMENT_ID,
    wb: "0",
    nowb: "1",
  });
  const json = await fetchJson(
    `https://docs.qq.com/dop-api/opendoc?${query}`,
    SOURCE_URL
  );
  const collab = json?.clientVars?.collab_client_vars;
  const headers = Array.isArray(collab?.header?.[0]?.d)
    ? collab.header[0].d.filter(
        (item: any) => item?.type === "grid" && typeof item.id === "string"
      )
    : [];
  if (!collab?.globalPadId || !Number.isInteger(Number(collab?.rev)))
    throw new Error("QQ workbook session metadata missing");
  return {
    headers,
    globalPadId: String(collab.globalPadId),
    rev: Number(collab.rev),
  };
}

async function fetchSheet(
  header: QqHeader,
  session: QqSession
): Promise<DecodedQqSheet> {
  let json: any;
  if (header.hidden) {
    const query = new URLSearchParams({
      padId: session.globalPadId,
      subId: header.id,
      startrow: "0",
      outformat: "1",
      normal: "1",
      preview_token: "",
      nowb: "1",
      endrow: "4095",
      needSheetState: "2",
      sliceStates: "1",
      block_end_col: "255",
      block_end_row: "4095",
      block_start_col: "0",
      block_start_row: "0",
      rev: String(session.rev),
      xsrf: "",
    });
    json = await fetchJson(
      `https://docs.qq.com/dop-api/get/sheet?${query}`,
      `${SOURCE_URL}?tab=${header.id}`
    );
  } else {
    const query = new URLSearchParams({
      outformat: "1",
      normal: "1",
      preview_token: "",
      id: DOCUMENT_ID,
      tab: header.id,
      wb: "0",
      nowb: "1",
    });
    json = await fetchJson(
      `https://docs.qq.com/dop-api/opendoc?${query}`,
      `${SOURCE_URL}?tab=${header.id}`
    );
  }
  const decoded = decodeQqWorksheetPayload(json, header.name);
  if (decoded.id !== header.id)
    throw new Error(
      `QQ sheet mismatch requested=${header.id} received=${decoded.id}`
    );
  return decoded;
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  operation: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, values.length) },
    async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await operation(values[index], index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function fetchWorkbookSnapshot() {
  const session = await openWorkbook();
  const headersById = new Map(
    session.headers.map(header => [header.id, header])
  );
  const orderedHeaders = EXPECTED_SHEETS.map(([id, expectedName]) => {
    const header = headersById.get(id);
    if (!header) throw new Error(`required QQ worksheet missing: ${id}`);
    if (header.name !== expectedName)
      throw new Error(`QQ worksheet name mismatch for ${id}`);
    return header;
  });
  if (session.headers.length !== EXPECTED_SHEET_COUNT)
    throw new Error(
      `QQ worksheet count changed: expected=${EXPECTED_SHEET_COUNT} actual=${session.headers.length}`
    );

  const sheets = await mapWithConcurrency(orderedHeaders, 6, header =>
    fetchSheet(header, session)
  );
  const visibleValues = sheets.reduce(
    (sum, sheet) => sum + sheet.cells.length,
    0
  );
  if (visibleValues < EXPECTED_VISIBLE_VALUE_MINIMUM)
    throw new Error(
      `QQ workbook extraction incomplete: values=${visibleValues}`
    );
  return { session, sheets, visibleValues };
}

export async function inspectLcfFirstEditionSource() {
  const snapshot = await fetchWorkbookSnapshot();
  const rendered = snapshot.sheets.map((sheet, index) =>
    renderQqSheetMarkdown(sheet, index + 1, snapshot.session.rev)
  );
  const combined = rendered.join("\n");
  const unredactedCredentials = combined
    .split(/\r?\n/)
    .filter(
      line =>
        /(?:密码|密碼|パスワード|password|secret|api\s*key|token)\s*[:：]/i.test(
          line
        ) &&
        !line.includes("[已安全省略]") &&
        !line.includes("[云盘账号与密码已安全省略]")
    ).length;
  const directEmails = (
    combined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  ).length;
  return {
    revision: snapshot.session.rev,
    sheetCount: snapshot.sheets.length,
    visibleValues: snapshot.visibleValues,
    totalLinks: snapshot.sheets.reduce(
      (sum, sheet) => sum + sheet.urls.length,
      0
    ),
    totalRenderedBytes: rendered.reduce(
      (sum, markdown) => sum + Buffer.byteLength(markdown),
      0
    ),
    maxRenderedBytes: Math.max(
      ...rendered.map(markdown => Buffer.byteLength(markdown))
    ),
    unredactedCredentials,
    directEmails,
    sheets: snapshot.sheets.map(sheet => ({
      id: sheet.id,
      name: sheet.name,
      values: sheet.cells.length,
      links: sheet.urls.length,
    })),
  };
}

function sourceId(sourceIds: Map<string, number>, sheetId: string): number {
  const id = sourceIds.get(sheetId);
  if (!id) throw new Error(`LCF source id missing for ${sheetId}`);
  return id;
}

export function buildLcfFirstEditionSopContent(sourceIds: Map<string, number>) {
  const refs = (...sheetIds: string[]) =>
    sheetIds.map(id => sourceId(sourceIds, id));
  const allRefs = EXPECTED_SHEETS.map(([id]) => sourceId(sourceIds, id));
  return {
    title: "9/8–9/9 LCF 1回目｜运营SOP与复盘知识",
    objective: {
      text: "将9月8日与9月9日LCF第1回活动的现存计划、责任、物料、品牌、达人、签到、嘉宾、直播、论坛、AWARD及撤场资料，沉淀为可检索、可交接、可复用的证据型SOP。计划、空白或待确认状态不被写成实际完成。",
      sourceRefs: refs("000021", "000022", "000024"),
    },
    scope: {
      text: "范围覆盖QQ原工作簿全部36张工作表。每张工作表均作为独立资料保存，保留坐标、显示内容与可提取的链接／图片引用；密码和直接联系方式按安全规则脱敏。",
      sourceRefs: allRefs,
    },
    roles: [
      {
        role: "现场总协调／区域负责人",
        responsibility:
          "统筹全体Check、区域配置、责任边界、问题升级、安装验收与撤场。具体人员与原记录以来源为准。",
        sourceRefs: refs("000001", "000021", "6or95w", "000025"),
      },
      {
        role: "签到・接待团队",
        responsibility:
          "运行品牌、主播、参展商／相关人员三通道，执行QR确认、核销、姓名牌、引导与异常升级。",
        sourceRefs: refs("00002b", "000029", "000022"),
      },
      {
        role: "主播・品牌匹配团队",
        responsibility:
          "维护主播×品牌×展位×时间总表，避免同展位同时间冲突，并预留到场、设备检查和换场缓冲。",
        sourceRefs: refs("000023", "000025", "000007"),
      },
      {
        role: "影像・直播・舞台团队",
        responsibility:
          "确认LED、摄像、音频、网络、直播电脑、PPT、Cue及DAY1／DAY2节目运行。",
        sourceRefs: refs("000022", "000024", "000026", "000029"),
      },
      {
        role: "嘉宾・后台・AWARD团队",
        responsibility:
          "按嘉宾个人Rundown管理到达、休息室、上台、餐食、停车、颁奖、座位及现场Cue。",
        sourceRefs: refs("000027", "000028", "lij66e", "023zy8", "00000b"),
      },
    ],
    prerequisites: [
      {
        item: "锁定唯一的品牌—展位—Logo／KV主数据，并明确会场方、施工方、X-NEXT与我方的准备、安装、验收、撤场责任。",
        sourceRefs: refs("mme4ia", "36v5gy", "m64r81", "00002c", "000021"),
      },
      {
        item: "以到货、数量、摆放、安装和功能验收关闭物料；不得以已下单或已打印替代现场验收。",
        sourceRefs: refs("00002a", "36v5gy", "m64r81", "00002c"),
      },
      {
        item: "实测最终及备用二维码、签到终端、网络、电源、LED、影像、音频、PPT和备用设备。",
        sourceRefs: refs("00002b", "000029", "d8h1dy", "000026"),
      },
    ],
    phases: [
      {
        name: "阶段0｜8/8基准Check与责任边界",
        goal: "形成会场、物料、人员、流程和未决事项的共同基准。",
        sourceRefs: refs("000021", "000025", "000029"),
        steps: [
          {
            order: 1,
            action:
              "逐项核对会场、物料、人员、流程及未决事项，并确认服务台／签到台方案。",
            owner: "现场总协调／各负责人",
            inputs: ["现场配置", "物料清单", "人员配置"],
            outputs: ["跟进清单", "责任边界"],
            completionCriteria: [
              "明确谁准备、谁安装、谁验收",
              "服务台不妨碍背景板与签到动线",
            ],
            cautions: ["原记录中服务台深度待确认", "计划状态不等于已完成"],
            sourceRefs: refs("000021", "000025", "000029"),
          },
        ],
      },
      {
        name: "阶段1｜品牌・达人・视觉・宣发准备",
        goal: "推进品牌出展、达人邀约、视觉文件、LED素材与活动宣发。",
        sourceRefs: refs(
          "000003",
          "000006",
          "5f3oda",
          "slepxz",
          "qpkpow",
          "lgfda3"
        ),
        steps: [
          {
            order: 1,
            action:
              "按品牌跟进状态处理合同、手引、付款、素材、物流和现场字段；按展位号管理视觉与印刷文件。",
            owner: "品牌对接／视觉物料团队",
            inputs: ["品牌跟进表", "展位图", "品牌素材"],
            outputs: ["出展现场版", "可印刷文件包"],
            completionCriteria: ["文件高清可印", "展位号、品牌名与现场一致"],
            cautions: ["条件性意向不得视为参展确认", "凭据不在LCJ Brain复制"],
            sourceRefs: refs("000003", "000006", "mme4ia", "qpkpow"),
          },
        ],
      },
      {
        name: "阶段2｜9/7进场、布展与全要素联测",
        goal: "把计划、物料和设备转换为现场可运行状态。",
        sourceRefs: refs("00002a", "36v5gy", "000026", "00002c", "000029"),
        steps: [
          {
            order: 1,
            action:
              "核对5F／6F布局、家具、供电、导视、签到、LED、直播区、舞台与观众席，并完成全要素彩排。",
            owner: "现场／施工／技术团队",
            inputs: ["安装图", "搬入清单", "Rundown", "设备清单"],
            outputs: ["现场验收记录", "异常清单"],
            completionCriteria: [
              "设备、网络、影像、音频、PPT和备用方案实测",
              "物料到场并完成摆放安装",
            ],
            cautions: ["物流表现有记录主要为字段，不能替代收货证据"],
            sourceRefs: refs("000008", "000026", "00002c", "000029"),
          },
        ],
      },
      {
        name: "阶段3｜DAY1 9/8签到、会场、直播与AWARD",
        goal: "运行开场检查、三通道签到、嘉宾接待、Brand Day、官方节目及LIVE COMMERCE AWARD・交流会。",
        sourceRefs: refs("000022", "00002b", "000023", "000027", "00000b"),
        steps: [
          {
            order: 1,
            action:
              "先完成全场Check和签到准备，再按三通道扫码、确认、核销、发放姓名牌并引导入场。",
            owner: "签到／会场团队",
            inputs: ["QR", "名单", "终端", "姓名牌", "指引"],
            outputs: ["签到与异常记录"],
            completionCriteria: [
              "高峰岗位与会场运营岗位分离",
              "异常按负责人升级",
            ],
            cautions: ["无QR或信息不一致须先确认", "通行动线表的细节记录有限"],
            sourceRefs: refs("000022", "00002b", "000029", "s4hi2i"),
          },
          {
            order: 2,
            action:
              "按最终主播排班和节目Rundown运行展位直播、嘉宾进退场、LED／音视频与AWARD流程。",
            owner: "匹配／舞台／嘉宾／AWARD团队",
            inputs: ["主播排班", "节目Rundown", "嘉宾资料", "AWARD名单与Cue"],
            outputs: ["现场运行记录", "问题与处置记录"],
            completionCriteria: [
              "单展位单时段仅一名主播",
              "节目素材、人员与Cue一致",
            ],
            cautions: ["排班、名单、Cue与完成情况须以现场版证据确认"],
            sourceRefs: refs("000023", "000027", "00000b", "000022"),
          },
        ],
      },
      {
        name: "阶段4｜DAY2 9/9论坛、现场运营与撤场",
        goal: "运行特别研讨会、间歇匹配和咨询，并完成离场、回收、归还与寄送。",
        sourceRefs: refs("000024", "000028", "00000a", "00002c"),
        steps: [
          {
            order: 1,
            action:
              "逐场确认登坛嘉宾、主持、麦克风、PPT、音响／影像、资料与时间控制；间歇继续会场与匹配运营。",
            owner: "论坛／舞台／会场团队",
            inputs: ["论坛Rundown", "PPT", "嘉宾资料"],
            outputs: ["论坛运行记录"],
            completionCriteria: [
              "资料、负责人和Rundown对应",
              "舞台与会场分工明确",
            ],
            cautions: ["候选课程及部分嘉宾在原记录中仍待最终确认"],
            sourceRefs: refs("000024", "000028", "00000a"),
          },
          {
            order: 2,
            action:
              "闭场后确认遗失物、物料、设备、制作物和样品，按归还／寄送对象分类并记录。",
            owner: "撤场／物流团队",
            inputs: ["回收清单", "返送标签", "包装材料"],
            outputs: ["归还／寄送去向记录"],
            completionCriteria: ["每项物料均有数量、去向和责任人"],
            cautions: ["原资料未形成完整的实际撤场与签收证明"],
            sourceRefs: refs("000024", "000008", "36v5gy", "00002c"),
          },
        ],
      },
    ],
    checklists: [
      {
        name: "版本・责任・物料闸门",
        items: [
          "品牌—展位—Logo／KV唯一主数据已锁定",
          "施工／会场／我方准备、安装、验收、撤场责任已确认",
          "视觉文件按展位号命名且高清可印",
          "物料已到场、计数、摆放、安装并功能验收",
        ],
        sourceRefs: refs("mme4ia", "36v5gy", "m64r81", "00002c"),
      },
      {
        name: "签到・技术・直播闸门",
        items: [
          "最终与备用QR已实测",
          "三通道终端、网络、电源、纸质名单、姓名牌与指引可用",
          "LED、影像、音频、直播电脑、摄像、麦克风、PPT及备用设备已联测",
          "主播×品牌×展位×时段无冲突且保留换场缓冲",
        ],
        sourceRefs: refs("00002b", "000029", "000023", "000026"),
      },
      {
        name: "嘉宾・论坛・AWARD・撤场闸门",
        items: [
          "每位嘉宾的到达、休息室、上台与离场Rundown已确认",
          "餐食、过敏原及停车位已确认",
          "论坛资料与负责人已对应",
          "AWARD名单、奖品、座位、音乐、控台与Cue已锁定",
          "撤场回收、归还和寄送去向已记录",
        ],
        sourceRefs: refs(
          "000027",
          "000028",
          "lij66e",
          "023zy8",
          "00000b",
          "00002c"
        ),
      },
    ],
    exceptionHandling: [
      {
        situation: "无法出示QR、登记信息不一致或未注册",
        response:
          "由签到工作人员先确认，必要时升级签到负责人；确认后再引导入场。具体核验标准和未获确认时的判断仍须补充。",
        sourceRefs: refs("00002b", "000029"),
      },
      {
        situation: "品牌无法按时提供视觉",
        response:
          "收集官网、主图、商品图或标语后按原记录补图；仍无法完成时转交指定设计支持，最终文件仍须满足印刷标准。",
        sourceRefs: refs("000021", "00002a", "36v5gy"),
      },
      {
        situation: "签到高峰",
        response:
          "使用原计划中的专任高峰配置，签到人员不兼任会场运营或休息室；高峰后再调整岗位。",
        sourceRefs: refs("000022", "000025"),
      },
    ],
    risks: [
      {
        risk: "展位主数据、责任边界、物料状态或最终版本不一致",
        mitigation:
          "确定唯一现场版；以到场、安装和功能验收关闭状态，并保留责任与版本记录。",
        sourceRefs: refs("mme4ia", "36v5gy", "m64r81", "00002c"),
      },
      {
        risk: "Brand Day排班无法执行或同展位时段冲突",
        mitigation:
          "按展位号维护主播×品牌×时间表，单展位单时段一名主播，并预留全链路缓冲。",
        sourceRefs: refs("000023", "000021", "000029"),
      },
      {
        risk: "QR、网络、LED、音视频或论坛资料未联调",
        mitigation:
          "9/7执行全要素联测，确认规格后输出终稿，并准备纸质名单和备用设备。",
        sourceRefs: refs("00002b", "000026", "000029", "00002c"),
      },
      {
        risk: "计划表被误读为完成记录",
        mitigation:
          "未开始、待完成、未确认、待确认和空白均保持原状态；必须由独立结果或验收证据关闭。",
        sourceRefs: refs("000021", "slepxz", "000029", "000022", "000024"),
      },
    ],
    lessonsLearned: [
      {
        lesson:
          "先确认提供方和规格再采购／制作；以展位号控制文件与排班；二维码、直播和论坛必须在现场以备用路径联测。以上是原资料中的可复用前置控制，不是事后效果结论。",
        sourceRefs: refs("36v5gy", "00002c", "d8h1dy", "00002b"),
      },
    ],
    gaps: [
      "现有资料主要是计划与待验证控制，不能证明活动实际完成、异常处置或效果。",
      "部分工作表只有标题／字段，物流、艺人路线、论坛细节与摄影交付的结果性证据不足。",
      "工作人员代号与真实姓名、最终展位主数据、最终主播排班、二维码测试、嘉宾／AWARD／论坛现场版仍需以责任人记录确认。",
      "凭据与直接联系方式为安全起见未复制到LCJ Brain；应在授权密码管理器或受控人事系统维护。",
    ],
    unresolvedQuestions: [
      "最终唯一的品牌—展位—Logo／KV现场版是哪一份？",
      "服务台方案、施工／安装／验收／撤场责任矩阵是否已签字确认？",
      "主播排班、嘉宾到达、论坛PPT、AWARD名单／奖品／Cue是否已有最终现场版？",
      "9/7设备、二维码、网络、音视频测试和两日检查表的实际结果在哪里？",
      "实际签到、到场／缺席、问题处置、撤场、归还／寄送和事后复盘记录在哪里？",
    ],
    sourceIndex: EXPECTED_SHEETS.map(([id, name]) => ({
      sourceId: sourceId(sourceIds, id),
      label: `${name}（QQ工作表 ${id}）`,
    })),
  };
}

async function seedHealth(connection: Connection): Promise<SeedHealth> {
  const [projectRows] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM lcj_brain_projects WHERE projectCode=? LIMIT 1",
    [PROJECT_CODE]
  );
  const projectId = projectRows[0]?.id ? Number(projectRows[0].id) : null;
  if (!projectId)
    return { projectId: null, sourceCount: 0, sopCount: 0, templateCount: 0 };
  const [[sourceRows], [sopRows], [templateRows]] = await Promise.all([
    connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM lcj_brain_project_sources WHERE projectId=? AND sourceKey LIKE ?",
      [projectId, `${SOURCE_PREFIX}%`]
    ),
    connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM lcj_brain_project_sop_versions WHERE projectId=? AND promptVersion=?",
      [projectId, SOP_PROMPT_VERSION]
    ),
    connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM lcj_brain_project_sop_templates WHERE sourceProjectId=? AND templateCode=?",
      [projectId, TEMPLATE_CODE]
    ),
  ]);
  return {
    projectId,
    sourceCount: Number(sourceRows[0]?.count || 0),
    sopCount: Number(sopRows[0]?.count || 0),
    templateCount: Number(templateRows[0]?.count || 0),
  };
}

function healthy(health: SeedHealth): boolean {
  return Boolean(
    health.projectId &&
      health.sourceCount === EXPECTED_SHEET_COUNT &&
      health.sopCount >= 1 &&
      health.templateCount >= 1
  );
}

async function resolveOwner(connection: Connection) {
  const [preferred] = await connection.query<RowDataPacket[]>(
    "SELECT id,COALESCE(name,email) AS name FROM users WHERE LOWER(email)='ryuhairartist@gmail.com' ORDER BY id LIMIT 1"
  );
  if (preferred[0]?.id)
    return {
      id: Number(preferred[0].id),
      name: String(preferred[0].name || "LCJ Owner"),
    };
  const [fallback] = await connection.query<RowDataPacket[]>(
    "SELECT id,COALESCE(name,email) AS name FROM users ORDER BY id LIMIT 1"
  );
  if (!fallback[0]?.id) throw new Error("LCF seed owner account missing");
  return {
    id: Number(fallback[0].id),
    name: String(fallback[0].name || "LCJ Owner"),
  };
}

function safeFileName(index: number, sheet: DecodedQqSheet): string {
  const safeName = sheet.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 100);
  return `${String(index).padStart(2, "0")}-${sheet.id}-${safeName}.md`;
}

async function upsertProjectAndSources(
  connection: Connection,
  snapshot: Awaited<ReturnType<typeof fetchWorkbookSnapshot>>
) {
  const owner = await resolveOwner(connection);
  let projectId: number;
  let createdProject = false;
  const [existingProjects] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM lcj_brain_projects WHERE projectCode=? LIMIT 1 FOR UPDATE",
    [PROJECT_CODE]
  );
  if (existingProjects[0]?.id) {
    projectId = Number(existingProjects[0].id);
  } else {
    const [projectResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO lcj_brain_projects
       (projectCode,name,projectType,description,objective,scope,status,startDate,endDate,
        ownerUserId,ownerName,memberUserIds,memberStaffIds,keywords,currentPhase,milestones,
        autoCollectEnabled,autoCollectMode,completedAt,createdBy,createdByName)
       VALUES (?,?,'event',?,?,?,'archived','2026-09-08','2026-09-09',?,?,?,?,?,?,?,0,'strict',CURRENT_TIMESTAMP,?,?)`,
      [
        PROJECT_CODE,
        "9/8–9/9 LCF 1回目",
        "QQ运营表全36工作表的历史快照、执行知识、检查清单与证据型SOP。",
        "把LCF第1回的计划、责任、物料、品牌、达人、签到、嘉宾、直播、论坛、AWARD和撤场知识完整沉淀，供后续活动复用。",
        "2026年9月8日–9日LCF第1回；完整导入36张QQ工作表，敏感凭据与直接联系方式除外。",
        owner.id,
        owner.name,
        JSON.stringify([owner.id]),
        JSON.stringify([]),
        JSON.stringify([
          "lcf",
          "9/8",
          "9/9",
          "展会",
          "brand day",
          "award",
          "签到",
          "物料",
        ]),
        "复盘・知识沉淀",
        JSON.stringify([
          { id: "day1", title: "DAY1 9/8", status: "completed" },
          { id: "day2", title: "DAY2 9/9", status: "completed" },
          { id: "knowledge", title: "36工作表与SOP归档", status: "completed" },
        ]),
        owner.id,
        owner.name,
      ]
    );
    projectId = Number(projectResult.insertId);
    createdProject = true;
  }

  const sourceIds = new Map<string, number>();
  const renderedSources = new Map<string, string>();
  for (const [index, sheet] of snapshot.sheets.entries()) {
    const sourceKey = `${SOURCE_PREFIX}${sheet.id}`;
    const content = renderQqSheetMarkdown(
      sheet,
      index + 1,
      snapshot.session.rev
    );
    renderedSources.set(sheet.id, content);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    const [existingSources] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM lcj_brain_project_sources WHERE projectId=? AND sourceKey=? LIMIT 1",
      [projectId, sourceKey]
    );
    if (existingSources[0]?.id) {
      sourceIds.set(sheet.id, Number(existingSources[0].id));
      continue;
    }
    const [sourceResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO lcj_brain_project_sources
       (projectId,sourceType,sourceId,sourceKey,title,summary,content,occurredAt,sourceUrl,
        fileName,mimeType,fileSize,sha256,matchedBy,matchReason,createdBy)
       VALUES (?,'note',?,?,?,?,?,?,?,?,'text/markdown; charset=utf-8',?,?,
        'system','QQ公开工作簿全量快照；密码与直接联系方式已安全脱敏',?)`,
      [
        projectId,
        sheet.id,
        sourceKey,
        `QQ工作表：${sheet.name}`,
        SOURCE_SUMMARIES[sheet.id] || "LCF第1回原始工作表快照。",
        content,
        EVENT_OCCURRED_AT,
        `${SOURCE_URL}?tab=${sheet.id}`,
        safeFileName(index + 1, sheet),
        Buffer.byteLength(content),
        sha256,
        owner.id,
      ]
    );
    sourceIds.set(sheet.id, Number(sourceResult.insertId));
  }

  for (const [id] of EXPECTED_SHEETS) {
    if (sourceIds.has(id)) continue;
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM lcj_brain_project_sources WHERE projectId=? AND sourceKey=? LIMIT 1",
      [projectId, `${SOURCE_PREFIX}${id}`]
    );
    if (!rows[0]?.id)
      throw new Error(`LCF source registration missing for ${id}`);
    sourceIds.set(id, Number(rows[0].id));
  }

  const allSourceIds = EXPECTED_SHEETS.map(([id]) => sourceId(sourceIds, id));
  let sopVersionId: number;
  let sopVersion: number;
  const [existingSops] = await connection.query<RowDataPacket[]>(
    "SELECT id,version FROM lcj_brain_project_sop_versions WHERE projectId=? AND promptVersion=? ORDER BY version DESC LIMIT 1",
    [projectId, SOP_PROMPT_VERSION]
  );
  if (existingSops[0]?.id) {
    sopVersionId = Number(existingSops[0].id);
    sopVersion = Number(existingSops[0].version);
  } else {
    const [versionRows] = await connection.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(version),0)+1 AS nextVersion FROM lcj_brain_project_sop_versions WHERE projectId=? FOR UPDATE",
      [projectId]
    );
    sopVersion = Number(versionRows[0]?.nextVersion || 1);
    const generatedAt = new Date().toISOString();
    const structured = attachSopGenerationMetadata(
      buildLcfFirstEditionSopContent(sourceIds),
      {
        mode: "full",
        baseVersionId: null,
        includedSourceIds: allSourceIds,
        newSourceIds: allSourceIds,
        removedSourceIds: [],
        generatedAt,
      }
    );
    const evidenceAppendix = EXPECTED_SHEETS.map(
      ([sheetId]) => renderedSources.get(sheetId) || ""
    )
      .filter(Boolean)
      .join("\n\n---\n\n");
    const markdown = [
      sopContentToMarkdown(structured),
      "\n\n---\n\n# 原始资料完整归档（36张工作表）",
      "\n> 以下内容按原工作表和单元格坐标保存；密码及直接联系方式已安全脱敏。",
      evidenceAppendix,
    ].join("\n\n");
    const [sopResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO lcj_brain_project_sop_versions
       (projectId,version,status,title,structuredContent,markdown,sourceIds,model,promptVersion,
        generatedBy,generatedByName,reason)
       VALUES (?,?,'final',?,?,?,?,'deterministic-evidence-import',?,?,?,?)`,
      [
        projectId,
        sopVersion,
        "9/8–9/9 LCF 1回目｜运营SOP与复盘知识",
        JSON.stringify(structured),
        markdown,
        JSON.stringify(allSourceIds),
        SOP_PROMPT_VERSION,
        owner.id,
        owner.name,
        `QQ工作簿revision ${snapshot.session.rev}的36表全量导入；敏感凭据与直接联系方式已脱敏`,
      ]
    );
    sopVersionId = Number(sopResult.insertId);
  }

  const templateContent = buildReusableSopTemplateContent(
    buildLcfFirstEditionSopContent(sourceIds)
  );
  await connection.query(
    `INSERT IGNORE INTO lcj_brain_project_sop_templates
     (templateCode,sourceProjectId,sourceProjectCode,sourceProjectName,sourceSopVersionId,
      sourceSopVersion,title,description,projectType,objectiveTemplate,scopeTemplate,
      keywordDefaults,currentPhaseTemplate,milestonesTemplate,autoCollectMode,structuredTemplate,
      markdownTemplate,status,revision,createdBy,createdByName)
     VALUES (?,?,?,?,?,?,?,?,'event',?,?,?,? ,?,'strict',?,?,'active',1,?,?)`,
    [
      TEMPLATE_CODE,
      projectId,
      PROJECT_CODE,
      "9/8–9/9 LCF 1回目",
      sopVersionId,
      sopVersion,
      "9/8–9/9 LCF 1回目 SOP模板",
      "LCF活动筹备、两日运行、签到、直播、论坛、AWARD与撤场的可复用模板。",
      "沉淀并复用LCF活动端到端运营方法。",
      "活动筹备、现场执行、复盘与知识沉淀。",
      JSON.stringify(["lcf", "展会", "brand day", "award", "签到", "物料"]),
      "筹备",
      JSON.stringify([
        { id: "template-day1", title: "DAY1", status: "pending" },
        { id: "template-day2", title: "DAY2", status: "pending" },
        { id: "template-review", title: "复盘与归档", status: "pending" },
      ]),
      JSON.stringify(templateContent),
      sopContentToMarkdown(templateContent),
      owner.id,
      owner.name,
    ]
  );

  if (createdProject) {
    await connection.query(
      `INSERT INTO lcj_brain_project_audit_logs
       (projectId,entityType,entityId,action,beforeJson,afterJson,actorId,actorName,reason)
       VALUES (?,'project',?,'project_seeded_from_qq',NULL,?,?,?,'用户要求将QQ工作簿全部知识沉淀为9/8–9/9 LCF第1回SOP')`,
      [
        projectId,
        projectId,
        JSON.stringify({
          sourceCount: EXPECTED_SHEET_COUNT,
          qqRevision: snapshot.session.rev,
          visibleValues: snapshot.visibleValues,
          sensitiveValuesRedacted: true,
        }),
        owner.id,
        SYSTEM_NAME,
      ]
    );
  }
  await connection.query(
    `INSERT IGNORE INTO lcj_brain_project_runs
     (projectId,runKey,runType,status,sourceCount,outputId,model,finishedAt)
     VALUES (?,?,'source_ingest','success',?,?, 'deterministic-evidence-import',CURRENT_TIMESTAMP)`,
    [
      projectId,
      `${PROJECT_CODE}:source-ingest:v1`,
      EXPECTED_SHEET_COUNT,
      sopVersionId,
    ]
  );

  return { projectId, owner, sopVersionId, sopVersion };
}

export async function getLcfFirstEditionSeedHealth(): Promise<
  SeedHealth & { healthy: boolean }
> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await ensureLcjBrainProjectUpgrade();
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const result = await seedHealth(connection);
    return { ...result, healthy: healthy(result) };
  } finally {
    await connection.end();
  }
}

async function runSeed(): Promise<void> {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for LCF project seed");
  await ensureLcjBrainProjectUpgrade();
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  let locked = false;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?,30) AS acquired",
      [LOCK_NAME]
    );
    locked = Number(lockRows[0]?.acquired) === 1;
    if (!locked) {
      console.log("[LcfFirstEditionSeed] another instance owns the seed lock");
      return;
    }
    const before = await seedHealth(connection);
    if (healthy(before)) {
      console.log(
        `[LcfFirstEditionSeed] healthy projectId=${before.projectId} sources=${before.sourceCount}`
      );
      return;
    }

    const snapshot = await fetchWorkbookSnapshot();
    await connection.beginTransaction();
    let result: Awaited<ReturnType<typeof upsertProjectAndSources>>;
    try {
      result = await upsertProjectAndSources(connection, snapshot);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const after = await seedHealth(connection);
    if (!healthy(after))
      throw new Error(
        `LCF first edition seed verification failed: sources=${after.sourceCount} sop=${after.sopCount} template=${after.templateCount}`
      );
    console.log(
      `[LcfFirstEditionSeed] success projectId=${result.projectId} sources=${after.sourceCount} sopVersion=${result.sopVersion} qqRevision=${snapshot.session.rev} values=${snapshot.visibleValues}`
    );
  } finally {
    if (locked)
      await connection
        .query("SELECT RELEASE_LOCK(?)", [LOCK_NAME])
        .catch(() => undefined);
    await connection.end();
  }
}

export function ensureLcfFirstEditionProjectSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch(error => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

export function expectedLcfSheetNames(): string[] {
  return EXPECTED_SHEETS.map(([id]) => EXPECTED_NAME_BY_ID.get(id) || id);
}
