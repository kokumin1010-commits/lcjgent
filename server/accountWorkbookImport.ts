import crypto from "node:crypto";
import path from "node:path";
import * as XLSX from "xlsx";

export const ACCOUNT_WORKBOOK_MAX_BYTES = 5 * 1024 * 1024;
export const ACCOUNT_WORKBOOK_SHEET = "经营用账户";

const SOURCE_KEY_PREFIX = "account-workbook-v1";
const HYPERLINK_FORMULA = /^HYPERLINK\("([^"]+)"(?:,\s*"([^"]*)")?\)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s()-]{7,}$/;
const NO_PASSWORD_MARKERS = new Set(["短信验证码", "验证码", "sms code", "verification code"]);

export type WorkbookAccountCandidate = {
  importKey: string;
  sourceRows: number[];
  platform: string;
  accountName: string;
  accountId: string | null;
  password: string | null;
  loginUrl: string | null;
  email: string | null;
  phone: string | null;
  responsible: string | null;
  status: "active";
  tags: string[];
  notes: string;
};

export type WorkbookContactCandidate = {
  importKey: string;
  sourceRows: number[];
  category: "supplier" | "other";
  companyName: string | null;
  contactName: string;
  email: null;
  phone: string | null;
  address: string;
  status: "active";
  tags: string[];
  notes: string;
};

export type WorkbookReferenceCandidate = {
  referenceKey: string;
  sourceRows: number[];
  category: "system" | "meeting" | "ai" | "workflow" | "other";
  name: string;
  url: string;
  notes: string;
};

export type WorkbookExcludedRow = {
  row: number;
  reason: "header" | "section" | "blank_relation" | "unsupported";
  label: string;
};

export type ParsedAccountWorkbook = {
  fileName: string;
  fileSha256: string;
  sheetName: string;
  sourceRowCount: number;
  accounts: WorkbookAccountCandidate[];
  contacts: WorkbookContactCandidate[];
  references: WorkbookReferenceCandidate[];
  excluded: WorkbookExcludedRow[];
};

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function hash(value: crypto.BinaryLike): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableKey(kind: string, ...parts: string[]): string {
  const normalized = parts.map(part => part.trim().toLowerCase()).join("|");
  return `${SOURCE_KEY_PREFIX}:${kind}:${hash(normalized).slice(0, 32)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function normalizeFilename(fileName: string): string {
  const base = path.basename(fileName || "account-import.xlsx");
  return base.slice(0, 255);
}

function validateWorkbookFile(fileName: string, buffer: Buffer): void {
  if (!/\.xlsx$/i.test(fileName)) {
    throw new Error("XLSXファイルだけをアップロードしてください / 仅支持XLSX文件");
  }
  if (buffer.length === 0 || buffer.length > ACCOUNT_WORKBOOK_MAX_BYTES) {
    throw new Error("ファイルは5MB以下にしてください / 文件大小必须在5MB以内");
  }
  if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
    throw new Error("XLSXの実体形式が正しくありません / XLSX文件格式不正确");
  }
}

function isValidHttpsUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function getUrl(sheet: XLSX.WorkSheet, rowNumber: number, fallbackValue: string): string {
  const cell = sheet[`B${rowNumber}`] as XLSX.CellObject | undefined;
  const formula = text(cell?.f).replace(/^=+/, "");
  const match = formula.match(HYPERLINK_FORMULA);
  const candidates = [
    text((cell as XLSX.CellObject & { l?: { Target?: string } })?.l?.Target),
    match?.[1] || "",
    fallbackValue,
    text(cell?.v),
    text(cell?.w),
  ];
  return candidates.find(isValidHttpsUrl) || "";
}

function classifyIdentifier(value: string): { accountId: string | null; email: string | null; phone: string | null } {
  if (!value) return { accountId: null, email: null, phone: null };
  if (EMAIL_RE.test(value)) return { accountId: value, email: value, phone: null };
  if (PHONE_RE.test(value)) return { accountId: value, email: null, phone: value.replace(/[\s()-]/g, "") };
  return { accountId: value, email: null, phone: null };
}

function platformFor(purpose: string, parent: string, url: string, notes: string): string {
  const source = `${purpose} ${parent} ${url} ${notes}`.toLowerCase();
  if (source.includes("百度")) return "百度网盘";
  if (source.includes("wps")) return "WPS";
  if (source.includes("apple")) return "Apple ID";
  if (source.includes("parceljet") || source.includes("erp系统查库存")) return "ParcelJet ERP";
  if (source.includes("qiye.aliyun.com") || parent.includes("邮箱类") || source.includes("邮箱和密码")) return "Alibaba Mail";
  if (source.includes("dropbox")) return "Dropbox";
  if (source.includes("kalodata")) return "Kalodata";
  if (source.includes("cloudsign")) return "CloudSign";
  if (source.includes("partner.tiktokshop.com")) return "TikTok Shop Partner";
  if (source.includes("seller-jp.tiktok.com") || source.includes("seller.tiktokshopglobalselling.com")) return "TikTok Shop";
  if (source.includes("chatgtp") || source.includes("chatgpt")) return "ChatGPT";
  if (source.includes("豆包") || source.includes("doubao")) return "豆包";
  if (source.includes("genspark")) return "Genspark";
  if (source.includes("manus")) return "Manus";
  if (source.includes("bommvideo") || source.includes("昆图")) return "Bommvideo";
  if (source.includes("libtv") || source.includes("liblib")) return "LiblibAI";
  if (parent.includes("紫鸟") || purpose.includes("紫鸟")) return "紫鸟";
  return "その他/Other";
}

const REDACTED_CREDENTIAL = "[REDACTED]";

function scrubCredentialFragments(value: string | null, secrets: string[]): string | null {
  if (!value) return value;
  let sanitized = value;
  for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
    if (!secret) continue;
    if (secret.length >= 6) {
      sanitized = sanitized.split(secret).join(REDACTED_CREDENTIAL);
    } else if (sanitized.trim() === secret) {
      sanitized = REDACTED_CREDENTIAL;
    }
  }
  return sanitized;
}

function accountNameFor(purpose: string, parent: string, notes: string, platform: string, accountId: string): string {
  const combined = `${purpose} ${notes}`.toLowerCase();
  if (combined.includes("labo celle") && platform === "TikTok Shop") return "LABO CELLE TikTok Shop";
  if (combined.includes("labo celle") && platform === "Alibaba Mail") return "LABO CELLE Email";
  if (combined.includes("mira beauty")) return "Mira Beauty TikTok Shop";
  if (combined.includes("dr 店铺子账号") || combined.includes("dr 店舗")) return "DR TikTok Shop 子账号";
  if (!purpose && parent.includes("紫鸟") && notes) return `紫鸟（${notes.replace(/账号|アカウント/gi, "").trim()}）`;
  if (parent.includes("邮箱类") && notes) return `${notes.trim()} Email`;
  if (purpose === "首次登录需要邮箱验证码") return "LCJ Inquiry Email";
  if (purpose === "邮箱类") return "LCJ Info Email";
  if (purpose === "ChatGTP") return "ChatGPT";
  if (purpose) return purpose;
  return `${platform} (${accountId})`;
}

function referenceCategory(purpose: string, url: string): WorkbookReferenceCandidate["category"] {
  const source = `${purpose} ${url}`.toLowerCase();
  if (source.includes("lcjmall.com")) return "system";
  if (source.includes("timerex")) return "meeting";
  if (source.includes("gemini")) return "ai";
  if (source.includes("set-applications")) return "workflow";
  return "other";
}

function contactCompanyName(purpose: string, address: string): string | null {
  if (purpose === "日本办公室") return "Live Commerce Japan株式会社";
  if (purpose === "杭州办公室") return "Hangzhou Shiyao Yuanyu Technology Co., Ltd.";
  if (purpose.toLowerCase().includes("pj") || address.includes("PJ サプライチェーン")) return "PJ サプライチェーン株式会社";
  if (purpose.includes("KG") || address.includes("株式会社Kyogoku")) return "株式会社Kyogoku";
  return null;
}

function contactPhone(address: string): string | null {
  const match = address.match(/(?:TEL|Tel|電話番号|手机号码|電話)\s*[:：]?\s*([+0-9][0-9\s-]{7,})/i);
  return match ? match[1].trim().replace(/\s+/g, " ") : null;
}

function isAddressPurpose(purpose: string, parent: string): boolean {
  return parent === "地址类" && /办公室|仓库/i.test(purpose);
}

function normalizeReferenceName(purpose: string): string {
  if (purpose === "lcj系统登录网站") return "LCJシステムユーザー管理";
  if (purpose === "オンラインMTGの調整リンク") return "オンラインMTG調整リンク";
  if (purpose.toLowerCase() === "gemini") return "Gemini";
  return purpose || "参照リンク";
}

function makeAccountNotes(notes: string, sourceRows: number[]): string {
  return unique([
    notes,
    `Excel原本行: ${sourceRows.join(", ")}`,
    "認証情報として確認済み。ブランド・Shop ID・SNS資料からの自動生成ではありません。",
  ]).join("\n");
}

export function parseAccountWorkbook(fileName: string, buffer: Buffer): ParsedAccountWorkbook {
  validateWorkbookFile(fileName, buffer);
  const fileSha256 = hash(buffer);
  const workbook = XLSX.read(buffer, { type: "buffer", cellFormula: true, cellHTML: false });
  const sheetName = workbook.SheetNames.includes(ACCOUNT_WORKBOOK_SHEET)
    ? ACCOUNT_WORKBOOK_SHEET
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("ワークシートがありません / 工作表不存在");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const header = (rows[0] || []).map(text);
  if (header[0] !== "用途" || header[2] !== "账号" || header[3] !== "密码") {
    throw new Error("列構成がLCJ経営管理表と一致しません / 表格列结构不匹配");
  }

  const accountGroups = new Map<string, WorkbookAccountCandidate>();
  const contactGroups = new Map<string, WorkbookContactCandidate>();
  const referenceGroups = new Map<string, WorkbookReferenceCandidate>();
  const excluded: WorkbookExcludedRow[] = [{ row: 1, reason: "header", label: "header" }];
  let section = "";

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const values = rows[index] || [];
    const purpose = text(values[0]);
    const accountValue = text(values[2]);
    const rawPassword = text(values[3]);
    const rowNotes = text(values[4]);
    const parent = text(values[7]);
    const nonEmpty = values.map(text).filter(Boolean);
    const url = getUrl(sheet, rowNumber, text(values[1]));

    if (nonEmpty.length === 0) continue;
    if (nonEmpty.length === 1 && purpose) {
      section = purpose;
      excluded.push({ row: rowNumber, reason: "section", label: purpose });
      continue;
    }
    const effectiveParent = parent || section;

    if (!purpose && !accountValue && !url && effectiveParent) {
      excluded.push({ row: rowNumber, reason: "blank_relation", label: effectiveParent });
      continue;
    }

    if (isAddressPurpose(purpose, effectiveParent) && accountValue) {
      const companyName = contactCompanyName(purpose, accountValue);
      const importKey = stableKey("contact", purpose, companyName || "");
      const existing = contactGroups.get(importKey);
      if (existing) {
        existing.sourceRows.push(rowNumber);
        existing.address = unique([existing.address, accountValue]).join("\n\n---\n\n");
        existing.notes = unique([existing.notes, rowNotes]).join("\n");
        if (!existing.phone) existing.phone = contactPhone(accountValue);
      } else {
        contactGroups.set(importKey, {
          importKey,
          sourceRows: [rowNumber],
          category: /仓库/i.test(purpose) ? "supplier" : "other",
          companyName,
          contactName: purpose,
          email: null,
          phone: contactPhone(accountValue),
          address: accountValue,
          status: "active",
          tags: unique(["Excel原本", effectiveParent, /仓库/i.test(purpose) ? "倉庫" : "オフィス"]),
          notes: rowNotes,
        });
      }
      continue;
    }

    const identifier = classifyIdentifier(accountValue);
    const passwordMarker = rawPassword.toLowerCase();
    const password = rawPassword && !NO_PASSWORD_MARKERS.has(passwordMarker) ? rawPassword : null;
    const isSystemLogin = purpose === "lcj系统登录网站" || url.includes("lcjmall.com/master/");
    const hasCredentialEvidence = Boolean(accountValue && (password || rawPassword || rowNotes || purpose || effectiveParent));

    if (url && (!hasCredentialEvidence || isSystemLogin || (purpose.toLowerCase() === "gemini" && !accountValue))) {
      const name = normalizeReferenceName(purpose || effectiveParent);
      const referenceKey = stableKey("reference", name, url);
      referenceGroups.set(referenceKey, {
        referenceKey,
        sourceRows: unique([...(referenceGroups.get(referenceKey)?.sourceRows || []).map(String), String(rowNumber)]).map(Number),
        category: referenceCategory(purpose, url),
        name,
        url,
        notes: unique([
          rowNotes,
          isSystemLogin
            ? "LCJログインはシステムユーザー管理で管理するため、プラットフォーム資格情報へ重複登録しません。"
            : "ログイン資格情報がない参照リンクとして保管。",
        ]).join("\n"),
      });
      continue;
    }

    if (hasCredentialEvidence && accountValue && !accountValue.includes("\n")) {
      const platform = platformFor(purpose, effectiveParent, url, rowNotes);
      const loginUrl = url || (platform === "Alibaba Mail" ? "https://qiye.aliyun.com" : "");
      const accountName = accountNameFor(purpose, effectiveParent, rowNotes, platform, accountValue);
      const importKey = stableKey("account", platform, accountValue);
      const existing = accountGroups.get(importKey);
      const tags = unique([
        "Excel原本",
        effectiveParent,
        !password && rawPassword ? "認証コード方式" : "",
        /验证码|認証コード|verification/i.test(`${purpose} ${rowNotes} ${rawPassword}`) ? "要認証コード" : "",
        /vpn/i.test(rowNotes) ? "VPN" : "",
      ]);
      if (existing) {
        if (existing.password && password && existing.password !== password) {
          throw new Error(`同一資格情報に異なるパスワードがあります / 同一凭据存在不同密码: rows ${existing.sourceRows.join(", ")}, ${rowNumber}`);
        }
        existing.sourceRows.push(rowNumber);
        existing.tags = unique([...existing.tags, ...tags]);
        const rawExistingNotes = existing.notes
          .split("\n")
          .filter(line => !line.startsWith("Excel原本行:") && !line.startsWith("認証情報として確認済み。"))
          .join("\n");
        existing.notes = makeAccountNotes(unique([rawExistingNotes, rowNotes]).join("\n"), existing.sourceRows);
        if (!existing.password && password) existing.password = password;
        if (!existing.loginUrl && loginUrl) existing.loginUrl = loginUrl;
      } else {
        accountGroups.set(importKey, {
          importKey,
          sourceRows: [rowNumber],
          platform,
          accountName,
          accountId: identifier.accountId,
          password,
          loginUrl: loginUrl || null,
          email: identifier.email,
          phone: identifier.phone,
          responsible: null,
          status: "active",
          tags,
          notes: makeAccountNotes(
            unique([
              rowNotes,
              !password && rawPassword ? `ログイン方式: ${rawPassword}` : "",
              purpose === "首次登录需要邮箱验证码" ? "初回ログイン時はメール認証コードが必要。" : "",
            ]).join("\n"),
            [rowNumber],
          ),
        });
      }
      continue;
    }

    excluded.push({ row: rowNumber, reason: "unsupported", label: purpose || effectiveParent || "unclassified" });
  }

  const rawAccounts = [...accountGroups.values()].map(account => ({
    ...account,
    sourceRows: [...new Set(account.sourceRows)].sort((a, b) => a - b),
  }));
  const credentialSecrets = unique(rawAccounts.map(account => account.password || "").filter(Boolean));
  const accounts = rawAccounts.map(account => {
    const sanitizedName = scrubCredentialFragments(account.accountName, credentialSecrets) || "";
    const sanitizedLoginUrl = scrubCredentialFragments(account.loginUrl, credentialSecrets);
    return {
      ...account,
      accountName: !sanitizedName || sanitizedName.includes(REDACTED_CREDENTIAL)
        ? `${account.platform} アカウント`
        : sanitizedName,
      loginUrl: sanitizedLoginUrl?.includes(REDACTED_CREDENTIAL) ? null : sanitizedLoginUrl,
      responsible: scrubCredentialFragments(account.responsible, credentialSecrets),
      tags: account.tags
        .map(tag => scrubCredentialFragments(tag, credentialSecrets) || "")
        .filter(tag => tag && !tag.includes(REDACTED_CREDENTIAL)),
      notes: scrubCredentialFragments(account.notes, credentialSecrets) || "",
    };
  });
  const contacts = [...contactGroups.values()].map(contact => ({
    ...contact,
    companyName: scrubCredentialFragments(contact.companyName, credentialSecrets),
    contactName: scrubCredentialFragments(contact.contactName, credentialSecrets) || "連絡先",
    email: scrubCredentialFragments(contact.email, credentialSecrets),
    phone: scrubCredentialFragments(contact.phone, credentialSecrets),
    address: scrubCredentialFragments(contact.address, credentialSecrets),
    tags: contact.tags
      .map(tag => scrubCredentialFragments(tag, credentialSecrets) || "")
      .filter(tag => tag && !tag.includes(REDACTED_CREDENTIAL)),
    sourceRows: [...new Set(contact.sourceRows)].sort((a, b) => a - b),
    notes: scrubCredentialFragments(unique([
      contact.notes,
      `Excel原本行: ${[...new Set(contact.sourceRows)].sort((a, b) => a - b).join(", ")}`,
    ]).join("\n"), credentialSecrets) || "",
  }));
  const references = [...referenceGroups.values()].map(reference => ({
    ...reference,
    name: scrubCredentialFragments(reference.name, credentialSecrets) || "参照リンク",
    url: scrubCredentialFragments(reference.url, credentialSecrets)?.includes(REDACTED_CREDENTIAL)
      ? ""
      : scrubCredentialFragments(reference.url, credentialSecrets) || "",
    notes: scrubCredentialFragments(reference.notes, credentialSecrets) || "",
    sourceRows: [...new Set(reference.sourceRows)].sort((a, b) => a - b),
  })).filter(reference => isValidHttpsUrl(reference.url));
  const sanitizedExcluded = excluded.map(row => ({
    ...row,
    label: scrubCredentialFragments(row.label, credentialSecrets) || "redacted",
  }));

  return {
    fileName: normalizeFilename(fileName),
    fileSha256,
    sheetName,
    sourceRowCount: rows.length,
    accounts,
    contacts,
    references,
    excluded: sanitizedExcluded,
  };
}

export function safeAccountWorkbookPreview(parsed: ParsedAccountWorkbook) {
  return {
    fileName: parsed.fileName,
    fileSha256: parsed.fileSha256,
    sheetName: parsed.sheetName,
    sourceRowCount: parsed.sourceRowCount,
    counts: {
      accounts: parsed.accounts.length,
      contacts: parsed.contacts.length,
      references: parsed.references.length,
      excluded: parsed.excluded.length,
    },
    accounts: parsed.accounts.map(account => ({
      importKey: account.importKey,
      sourceRows: account.sourceRows,
      platform: account.platform,
      accountName: account.accountName,
      loginUrl: account.loginUrl,
      identifierType: account.email ? "email" : account.phone ? "phone" : account.accountId ? "username" : "none",
      identifierMasked: account.email
        ? `${account.email.slice(0, 2)}***@${account.email.split("@")[1]}`
        : account.phone
          ? `***${account.phone.replace(/\D/g, "").slice(-4)}`
          : account.accountId
            ? `${account.accountId.slice(0, 2)}***${account.accountId.slice(-2)}`
            : "",
      hasPassword: Boolean(account.password),
      tags: account.tags,
    })),
    contacts: parsed.contacts.map(contact => ({
      importKey: contact.importKey,
      sourceRows: contact.sourceRows,
      category: contact.category,
      companyName: contact.companyName,
      contactName: contact.contactName,
      hasPhone: Boolean(contact.phone),
    })),
    references: parsed.references.map(reference => ({
      referenceKey: reference.referenceKey,
      sourceRows: reference.sourceRows,
      category: reference.category,
      name: reference.name,
      url: reference.url,
    })),
    excluded: parsed.excluded,
  };
}
