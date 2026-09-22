export const LINE_PUBLIC_CONTACT_NAME = "高橋 悠真";
export const LINE_INITIAL_AUTOMATION_NOTICE = "※初回のご案内と確認には自動サポートを利用しています。";

const LINE_PUBLIC_SIGNATURE_SUFFIX = /\n{0,2}—\s*(?:LCJ公式AIマネージャー|LCJ公式・専属AIマネージャー|LCJ公式LINE(?:（自動フォロー）)?|LCJ運営（手動）|高橋\s*悠真)\s*$/u;

export function stripLinePublicSignature(text: unknown): string {
  return String(text || "")
    .replace(LINE_PUBLIC_SIGNATURE_SUFFIX, "")
    .trim();
}
