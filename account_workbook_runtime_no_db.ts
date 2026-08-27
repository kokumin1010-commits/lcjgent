import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.JWT_SECRET ||= "account-workbook-runtime-regression-secret-2026";

const { parseAccountWorkbook, safeAccountWorkbookPreview } = await import("./server/accountWorkbookImport");
const { encryptAccountSecret, decryptAccountSecret, isEncryptedAccountSecret } = await import("./server/accountCredentialCrypto");
const { appRouter } = await import("./server/routers");

const sourcePath = "/home/ubuntu/upload/pasted_file_06GgiQ_LCJ経営管理表_经营用账户.xlsx";
const source = readFileSync(sourcePath);
const parsed = parseAccountWorkbook("LCJ経営管理表_经营用账户.xlsx", source);
const safePreview = safeAccountWorkbookPreview(parsed);

type Result = { name: string; passed: boolean; details?: string };
const results: Result[] = [];
const record = (name: string, passed: boolean, details = "") => results.push({ name, passed, details });

record("source_sha256", parsed.fileSha256 === "78c837ae232f76fee8061257906b86af3a36afb19a586f3311065c2bfacecb18");
record("classification_counts", parsed.accounts.length === 22 && parsed.contacts.length === 4 && parsed.references.length === 4 && parsed.excluded.length === 11);
const parsedAgain = parseAccountWorkbook("LCJ経営管理表_经营用账户.xlsx", source);
record("parser_deterministic", JSON.stringify(parsedAgain.accounts.map(account => account.importKey)) === JSON.stringify(parsed.accounts.map(account => account.importKey)));
record("account_source_keys_unique", new Set(parsed.accounts.map(account => account.importKey)).size === parsed.accounts.length);
record("contact_source_keys_unique", new Set(parsed.contacts.map(contact => contact.importKey)).size === parsed.contacts.length);
record("reference_source_keys_unique", new Set(parsed.references.map(reference => reference.referenceKey)).size === parsed.references.length);
record("credential_identifiers_present", parsed.accounts.every(account => Boolean(account.accountId || account.email || account.phone)));
record("reference_urls_https", parsed.references.every(reference => reference.url.startsWith("https://")));
record("safe_preview_no_password_field", safePreview.accounts.every((account: any) => !("password" in account)));
record("safe_preview_masked_identifiers", safePreview.accounts.every((account: any) => !account.identifierMasked || account.identifierMasked.includes("***")));

const passwordAccounts = parsed.accounts.filter(account => account.password);
const credentialSecrets = passwordAccounts.map(account => account.password!).filter(Boolean);
const parsedWithoutPasswordFields = {
  ...parsed,
  accounts: parsed.accounts.map(({ password: _password, ...account }) => account),
};
const nonSecretParsedText = JSON.stringify(parsedWithoutPasswordFields);
const safePreviewText = JSON.stringify(safePreview);
record(
  "parsed_non_secret_fields_no_credential_fragments",
  credentialSecrets.every(secret => !nonSecretParsedText.includes(secret)),
);
record(
  "safe_preview_no_credential_fragments",
  credentialSecrets.every(secret => !safePreviewText.includes(secret)),
);
const encrypted = passwordAccounts.map(account => ({ plain: account.password!, envelope: encryptAccountSecret(account.password)! }));
record("all_passwords_encrypted", encrypted.length > 0 && encrypted.every(item => item.envelope !== item.plain && isEncryptedAccountSecret(item.envelope)));
record("all_passwords_round_trip", encrypted.every(item => decryptAccountSecret(item.envelope) === item.plain));
let tamperRejected = false;
try {
  const sample = encrypted[0].envelope;
  const replacement = sample.endsWith("A") ? "B" : "A";
  decryptAccountSecret(sample.slice(0, -1) + replacement);
} catch {
  tamperRejected = true;
}
record("tampered_envelope_rejected", tamperRejected);

function expectParserError(name: string, fileName: string, buffer: Buffer, expected: string) {
  try {
    parseAccountWorkbook(fileName, buffer);
    record(name, false, "expected error but succeeded");
  } catch (error: any) {
    const message = String(error?.message || error);
    record(name, message.includes(expected), message);
  }
}
expectParserError("reject_non_xlsx_extension", "accounts.csv", source, "XLSX");
expectParserError("reject_invalid_signature", "accounts.xlsx", Buffer.from("not-an-xlsx"), "実体形式");
expectParserError("reject_oversized_file", "accounts.xlsx", Buffer.alloc(5 * 1024 * 1024 + 1, 0x50), "5MB");

const anonymous = appRouter.createCaller({ req: { headers: {} } as any, res: {} as any, user: null });
async function expectUnauthorized(name: string, operation: () => Promise<unknown>) {
  try {
    await operation();
    record(name, false, "expected UNAUTHORIZED but succeeded");
  } catch (error: any) {
    const code = String(error?.code || error?.data?.code || "UNKNOWN");
    record(name, code === "UNAUTHORIZED", code);
  }
}

const base64 = source.toString("base64");
await expectUnauthorized("anonymous_list_accounts", () => anonymous.account.listAccounts());
await expectUnauthorized("anonymous_preview_workbook", () => anonymous.account.previewWorkbook({ fileName: "accounts.xlsx", fileBase64: base64 }));
await expectUnauthorized("anonymous_import_workbook", () => anonymous.account.importWorkbook({ fileName: "accounts.xlsx", fileBase64: base64, confirmSha256: parsed.fileSha256 }));
await expectUnauthorized("anonymous_list_contacts", () => anonymous.account.listContacts());
await expectUnauthorized("anonymous_list_references", () => anonymous.account.listReferences());
await expectUnauthorized("anonymous_import_history", () => anonymous.account.listWorkbookImports());

const failed = results.filter(result => !result.passed);
const report = {
  mode: "parser+crypto+createCaller/no-database-write",
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.map(result => result.name),
  productionWrites: 0,
  credentialValuesLogged: 0,
  results,
};
writeFileSync(resolve(process.cwd(), "account_workbook_runtime_no_db.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exit(1);
