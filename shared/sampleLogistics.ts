export const SAMPLE_LOGISTICS_STATUSES = [
  "preparing",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_exception",
  "returned",
] as const;

export type SampleLogisticsStatus = (typeof SAMPLE_LOGISTICS_STATUSES)[number];

export const SAMPLE_LOGISTICS_LABELS: Record<SampleLogisticsStatus, string> = {
  preparing: "発送準備中",
  shipped: "発送済み",
  in_transit: "配送中",
  out_for_delivery: "配達中",
  delivered: "配達完了",
  delivery_exception: "配送確認が必要",
  returned: "返送",
};

export function isSampleLogisticsStatus(value: unknown): value is SampleLogisticsStatus {
  return typeof value === "string" && SAMPLE_LOGISTICS_STATUSES.includes(value as SampleLogisticsStatus);
}

export function buildCarrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const cleanCarrier = String(carrier || "").trim().toLowerCase();
  const cleanTracking = String(trackingNumber || "").trim();
  if (!cleanCarrier || !cleanTracking) return null;
  const encoded = encodeURIComponent(cleanTracking);
  if (cleanCarrier.includes("ヤマト") || cleanCarrier.includes("yamato") || cleanCarrier.includes("クロネコ")) {
    return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${encoded}`;
  }
  if (cleanCarrier.includes("佐川") || cleanCarrier.includes("sagawa")) {
    return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${encoded}`;
  }
  if (cleanCarrier.includes("日本郵便") || cleanCarrier.includes("ゆうパック") || cleanCarrier.includes("ユーパック") || cleanCarrier.includes("japan post")) {
    return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${encoded}`;
  }
  if (cleanCarrier.includes("西濃") || cleanCarrier.includes("seino")) {
    return `https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${encoded}`;
  }
  return null;
}

export function normalizeHttpsUrl(value: string | null | undefined): string | null {
  const clean = String(value || "").trim();
  if (!clean) return null;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!hostname || hostname === "localhost" || [".localhost", ".local", ".internal", ".lan", ".home", ".test", ".invalid"].some(suffix => hostname.endsWith(suffix))) return null;
    // Tracking providers use DNS names. Reject every IPv6 literal so mapped IPv4,
    // loopback, unspecified, ULA, link-local and reserved forms cannot bypass the
    // public-host rule through alternate textual encodings.
    if (hostname.includes(":")) return null;
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
    if (ipv4) {
      if (ipv4.some(part => part < 0 || part > 255)) return null;
      const [a, b, c] = ipv4;
      if (a === 0 || a === 10 || a === 127 || a >= 224 ||
          a === 100 && b >= 64 && b <= 127 ||
          a === 169 && b === 254 ||
          a === 172 && b >= 16 && b <= 31 ||
          a === 192 && (b === 0 && (c === 0 || c === 2) || b === 88 && c === 99 || b === 168) ||
          a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
          a === 203 && b === 0 && c === 113) return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
