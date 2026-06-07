/**
 * メールアドレスバリデーションユーティリティ
 * スクレイピング時に誤取得された画像ファイル名やダミーアドレスを除外する
 */

// 画像・メディアファイル拡張子（ドメイン部分に含まれる場合は無効）
const INVALID_DOMAIN_EXTENSIONS = [
  '.svg', '.webp', '.gif', '.png', '.jpg', '.jpeg', '.bmp', '.ico',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.css', '.js', '.html', '.htm', '.php', '.asp',
];

// ダミー・テスト用のローカルパート（@の前の部分）
const DUMMY_LOCAL_PARTS = [
  'example', 'sample', 'test', 'demo', 'dummy', 'fake',
  'xxx', 'xxxx', 'xxxxx', 'aaa', 'aaaa', 'bbb', 'ccc',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'mail', 'email', 'info_test', 'test_mail',
];

// ダミードメイン
const DUMMY_DOMAINS = [
  'example.com', 'example.jp', 'example.co.jp', 'example.org', 'example.net',
  'test.com', 'test.jp', 'sample.com', 'sample.jp',
  'dmain.com', // typo of domain.com often used as placeholder
  'localhost', 'invalid',
];

// 画像ファイル名パターン（@2xなどのRetina表記を含む）
const IMAGE_FILE_PATTERNS = [
  /@[0-9]+x\./i,           // @2x.png, @3x.webp etc
  /^img[_-]/i,             // img_office@..., img-header@...
  /^icon[_-]/i,            // icon_mail@...
  /^logo[_-]/i,            // logo_company@...
  /^banner[_-]/i,          // banner_top@...
  /^bg[_-]/i,              // bg_main@...
  /^btn[_-]/i,             // btn_submit@...
  /^link[_-]text/i,        // link-text@...
  /^dd_[a-z]+_\d/i,       // dd_bl_30x@...
  /^mum@/i,               // mum@2x.webp
  /^inquiry_ttl/i,         // inquiry_ttl@...
  /^img[-_]salonpark/i,    // img-salonpark-gnav@...
];

/**
 * メールアドレスが有効かどうかを判定
 * @returns true = 有効, false = 無効（送信すべきでない）
 */
export function isValidEmailForSending(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  const trimmed = email.trim().toLowerCase();

  // 基本的なメール形式チェック
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(trimmed)) return false;

  const [localPart, domain] = trimmed.split('@');
  if (!localPart || !domain) return false;

  // ドメインにTLDが必要（最低1つのドット）
  if (!domain.includes('.')) return false;

  // ドメインが画像/メディアファイル拡張子で終わる場合は無効
  for (const ext of INVALID_DOMAIN_EXTENSIONS) {
    if (domain.endsWith(ext)) return false;
  }

  // ドメイン名にファイル拡張子が含まれている場合は無効（例: sp.svg, 2x.png.webp）
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  const validTLDs = ['com', 'jp', 'co', 'org', 'net', 'info', 'biz', 'io', 'me', 'tv', 'cc', 'us', 'uk', 'de', 'fr', 'cn', 'tw', 'kr', 'sg', 'th', 'vn', 'id', 'ph', 'my', 'au', 'nz', 'ca', 'br', 'ru', 'in', 'za', 'mx', 'ar', 'cl', 'pe', 'co', 'ec', 've', 'uy', 'py', 'bo', 'cr', 'pa', 'gt', 'hn', 'sv', 'ni', 'cu', 'do', 'pr', 'tt', 'jm', 'ht', 'bs', 'bb', 'ag', 'dm', 'gd', 'kn', 'lc', 'vc', 'edu', 'gov', 'mil', 'ac', 'ne', 'or', 'go', 'ad', 'gr', 'tokyo', 'osaka', 'nagoya', 'yokohama', 'shop', 'store', 'online', 'site', 'website', 'app', 'dev', 'tech', 'cloud', 'digital', 'media', 'design', 'studio', 'agency', 'group', 'team', 'work', 'pro', 'expert', 'consulting', 'solutions', 'services', 'systems', 'network', 'global', 'international', 'world', 'asia', 'europe', 'africa', 'america', 'club', 'community', 'social', 'blog', 'news', 'press', 'live', 'space', 'xyz', 'top', 'win', 'bid', 'trade', 'market', 'money', 'finance', 'insurance', 'health', 'fitness', 'beauty', 'fashion', 'food', 'travel', 'hotel', 'restaurant', 'cafe', 'bar', 'salon', 'spa', 'clinic', 'dental', 'medical', 'hospital', 'pharmacy', 'vet', 'pet', 'garden', 'house', 'home', 'land', 'property', 'estate', 'rent', 'lease', 'build', 'construction', 'repair', 'clean', 'moving', 'storage', 'transport', 'delivery', 'express', 'post', 'mail'];
  // 画像拡張子がTLDとして使われている場合は無効
  const imageExtensions = ['svg', 'webp', 'gif', 'png', 'jpg', 'jpeg', 'bmp', 'ico', 'tiff', 'psd', 'ai', 'eps'];
  if (imageExtensions.includes(tld)) return false;

  // ダミーローカルパートチェック
  for (const dummy of DUMMY_LOCAL_PARTS) {
    if (localPart === dummy) return false;
  }

  // ダミードメインチェック
  for (const dummyDomain of DUMMY_DOMAINS) {
    if (domain === dummyDomain) return false;
  }

  // 画像ファイル名パターンチェック（@を含む画像ファイル名を誤認識したもの）
  for (const pattern of IMAGE_FILE_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // ドメインがハイフンで始まるまたは終わる場合は無効
  for (const part of domainParts) {
    if (part.startsWith('-') || part.endsWith('-')) return false;
  }

  // ローカルパートが数字のみ＋画像サイズパターン（例: 30x, 2x）の場合は無効
  if (/^\d+x$/.test(localPart)) return false;

  return true;
}

/**
 * 無効メールの理由を返す（デバッグ・UI表示用）
 */
export function getInvalidEmailReason(email: string): string | null {
  if (!email || typeof email !== 'string') return "空のメールアドレス";

  const trimmed = email.trim().toLowerCase();

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(trimmed)) return "メール形式が不正";

  const [localPart, domain] = trimmed.split('@');
  if (!localPart || !domain) return "メール形式が不正";
  if (!domain.includes('.')) return "ドメインにTLDがない";

  for (const ext of INVALID_DOMAIN_EXTENSIONS) {
    if (domain.endsWith(ext)) return `ドメインがファイル拡張子(${ext})で終わる`;
  }

  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  const imageExtensions = ['svg', 'webp', 'gif', 'png', 'jpg', 'jpeg', 'bmp', 'ico', 'tiff', 'psd', 'ai', 'eps'];
  if (imageExtensions.includes(tld)) return `TLDが画像拡張子(${tld})`;

  for (const dummy of DUMMY_LOCAL_PARTS) {
    if (localPart === dummy) return `ダミーアドレス(${dummy}@...)`;
  }

  for (const dummyDomain of DUMMY_DOMAINS) {
    if (domain === dummyDomain) return `ダミードメイン(${dummyDomain})`;
  }

  for (const pattern of IMAGE_FILE_PATTERNS) {
    if (pattern.test(trimmed)) return "画像ファイル名パターン";
  }

  for (const part of domainParts) {
    if (part.startsWith('-') || part.endsWith('-')) return `ドメイン名が不正(${part})`;
  }

  if (/^\d+x$/.test(localPart)) return "画像サイズパターン";

  return null; // 有効
}
