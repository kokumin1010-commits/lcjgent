export function normalizeSafeHttpUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048 || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new Error("URL格式无效");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL格式无效");
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("仅支持HTTP或HTTPS链接");
  }
  if (parsed.username || parsed.password || !parsed.hostname || parsed.hostname.length > 253) {
    throw new Error("URL不能包含账号凭据且必须具有有效主机名");
  }
  return parsed.toString();
}

export function safeHttpUrlOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return normalizeSafeHttpUrl(value);
  } catch {
    return null;
  }
}
