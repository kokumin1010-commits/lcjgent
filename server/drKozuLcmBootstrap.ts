import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export const DRKOZU_LCM_BOOTSTRAP_KEY = "drkozu-lcm-normal-brand-2026-v1";
export const DRKOZU_LCM_ACCOUNT_EMAIL = "drkozu-lcm-cklubx5i4g@livecommercefestival.com";
const DRKOZU_LCM_INITIAL_PASSWORD_HASH = "v2:8150bf141f36f435194f85894254876c:227bc10eb15b9aeb149462ebe4cb05cc13e2c1b458026baf96ada3f4a89e0db38ce9a2ee5b9a9e03064612d827b7e573c593170320c23ca4013815a6e3c1f132";
const SOURCE_PDF_SHA256 = "d390b78a9afa81c7e53452abfa4d771ddbca1a5f3ebfa048db1280a6dd9de509";
const SOURCE_PDF_SIZE = 8_293_906;
const SOURCE_PDF_PATH = resolve(process.cwd(), "server/recoveryData/Dr.Kozu_Brand_Book_JP_2026_v5.pdf");
const ASSET_ROOT = resolve(process.cwd(), "client/public/lcm/drkozu");
const PUBLIC_ASSET_ROOT = "https://www.livecommercefestival.com/lcm/drkozu";
const LOCK_NAME = "drkozu-lcm-normal-brand-bootstrap";
const LCM_TERMS_VERSION = "2026-09-16-v2";
const SOURCE_CATALOG_PAGE = 31;

type BootstrapRuntimeState = "pending" | "running" | "completed" | "failed";
let bootstrapStage = "not_started";
let bootstrapRuntime: {
  state: BootstrapRuntimeState;
  failureCode: string | null;
  updatedAt: string;
} = { state: "pending", failureCode: null, updatedAt: new Date().toISOString() };

function setBootstrapRuntime(state: BootstrapRuntimeState, stage: string, failureCode: string | null = null): void {
  bootstrapStage = stage;
  bootstrapRuntime = { state, failureCode, updatedAt: new Date().toISOString() };
}

function safeBootstrapFailureCode(error: unknown, stage = bootstrapStage): string {
  const message = error instanceof Error ? error.message : "";
  if (/^DRKOZU_LCM_[A-Za-z0-9_:.-]+$/.test(message)) return message.slice(0, 120);
  const sqlCode = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  const safeStage = stage.replace(/[^a-z0-9_]/gi, "_").toUpperCase().slice(0, 50) || "UNKNOWN";
  const safeSqlCode = /^[A-Z0-9_]+$/.test(sqlCode) ? sqlCode.slice(0, 50) : "FAILED";
  return `DRKOZU_LCM_${safeStage}_${safeSqlCode}`;
}

const ASSET_SHA256: Readonly<Record<string, string>> = {
  "brand-cover.webp": "e970485348294f8eac13f18f4fe2c9cb53abe7d21cd66800c7a5d33780aca756",
  "brand-logo.webp": "23af5fed3b00654a0a66e50b379d8c0b0eb811276d0fe7b7da64bb35bc2e2c50",
  "p14-product.webp": "582f97620d8b935061c8eae153928411e2ba070e32fbe0ae0ef6bc951be37023",
  "p18-product.webp": "831886c8e7088d0998918552004f972d37b49c6a0bdd1eef12ed093626f458fb",
  "p22-product.webp": "d292392bfb890e45391919d3a88aa711b72f9f09a30de28c69dbb469c294c672",
  "p23-product.webp": "ceb9ce2975f946e8b381390f8ff27aaf25fc825ff86da53e854d27c67627bade",
  "p28-product.webp": "ef72c6a68bd85b64638f363d455197d0adf16ce255d77b579c1f8fa24b164ee1",
  "p32-product.webp": "4f028c04daed63eef8348b0b16fb459ccc37b83846bec6d8b1cf38fc31d90a92",
  "p36-product.webp": "15c081c36ff04797c3de19aa9e3531c0373d36e88044ad5e9ebfcdedda790021",
  "p40-product.webp": "d2e500e64819950d775f3c122928b0e869b849b94e39e80721d82fac9bdc4201",
  "p43-product.webp": "04a2654247b349a5aaf27c47a4ae0c6abdae22e2480c61f3f5f2d9f22d6a6fb1",
  "p44-product.webp": "4e647d68ac595fd2d4f2b7597c2bc8ec80abd9696021ab2fb918b3801d8df7c4",
  "p45-product.webp": "4641ec45364fda08b388aaf9386cc85df85d4a8c7571f9e333371ff5d3b6be37",
};

type ProductSeed = {
  page: number;
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  highlights: string[];
  thirtySecondPitch: string;
  demoInstructions: string;
  targetAudience: string;
  prohibitedClaims: string;
  listPrice: number;
};

export const DRKOZU_LCM_PRODUCTS: readonly ProductSeed[] = [
  {
    page: 14,
    slug: "drkozu-beauty-soy-protein",
    name: "ビューティソイプロテイン",
    category: "インナーケア・健康食品",
    summary: "大豆プロテインをベースに、毎日の美容習慣へ取り入れやすくしたココア風味のプロテイン。500g。",
    description: "水・牛乳・豆乳に溶かして飲む、500g入りの大豆プロテインです。ブランドブックでは、コラーゲンペプチド、ヒアルロン酸、モリンガ、食物繊維などの配合が紹介されています。食品表示、原材料、アレルゲン、摂取目安は実物パッケージを確認してください。",
    highlights: ["500g", "大豆プロテインベース", "水・牛乳・豆乳で手軽に", "ココア風味"],
    thirtySecondPitch: "毎日の食生活に取り入れやすいココア風味の大豆プロテイン。水・牛乳・豆乳で手軽に続けられる500gサイズです。",
    demoInstructions: "商品パッケージに記載された量を水・牛乳・豆乳へ入れ、十分に混ぜてください。摂取目安と保存方法はパッケージ表示を優先します。",
    targetAudience: "日常的にたんぱく質を補いたい方、美容習慣として続けやすいプロテインを探している方。",
    prohibitedClaims: "一度で美容効果が出る、減量できる、病気が治る等の保証表現は使用しないでください。原材料・アレルゲン・摂取目安は必ず商品表示を確認してください。",
    listPrice: 8856,
  },
  {
    page: 18,
    slug: "drkozu-vampire-mask",
    name: "ヴァンパイアマスク",
    category: "スキンケア",
    summary: "パウダーとセラムを使用直前に混ぜ、約20分後に洗い流す6回分の集中ケアマスク。",
    description: "使用直前にパウダーとセラムを混ぜ、ムラなく塗布して約20分後に洗い流すスペシャルケアです。ブランドブックではパパイン酵素、ヒアルロン酸、コラーゲン、セラミドNPなどの配合が紹介されています。",
    highlights: ["6回分", "パウダーとセラムの2剤式", "約20分の集中ケア", "洗い流すタイプ"],
    thirtySecondPitch: "混ぜる、塗る、洗い流すという工程そのものがライブで伝わりやすい、6回分の集中ケアマスクです。",
    demoInstructions: "パウダーとセラムを使用直前に混ぜ、ムラなく塗布します。約20分後、商品説明に従って十分に洗い流してください。",
    targetAudience: "自宅で丁寧な集中ケアを取り入れたい方、使用工程を見せるライブデモを行いたい方。",
    prohibitedClaims: "若返る、細胞を再生する、治療できる等の医療的な断定はしないでください。肌状態を確認し、異常がある場合は使用を中止してください。",
    listPrice: 15950,
  },
  {
    page: 22,
    slug: "drkozu-cell-peel-crystal",
    name: "セルピール #クリスタル",
    category: "スキンケア",
    summary: "番号順の4ステップで角質ケアから保湿まで行う、1回使い切りタイプの4回分セット。",
    description: "準備、角質ケア、バランス調整、セラム仕上げを番号順に行うホームケアセットです。目元・口元や傷のある部位を避け、使用後は十分な保湿と日中の紫外線対策を行ってください。",
    highlights: ["4回分", "1回使い切りタイプ", "番号順の4ステップ", "角質ケア後の保湿まで"],
    thirtySecondPitch: "使う順番が分かりやすい4ステップ設計。角質ケアだけで終わらず、バランス調整とセラム仕上げまでを一式にしています。",
    demoInstructions: "セットの番号順に使用します。目元・口元・傷のある部位は避け、当日は刺激の強いケアとの併用を控え、使用後は保湿と紫外線対策を行ってください。",
    targetAudience: "ざらつきや乾燥が気になり、手順の明確なホーム角質ケアを探している方。",
    prohibitedClaims: "美白、シミ改善、ニキビ跡改善等を医薬品のように保証しないでください。敏感な状態や刺激の強い成分を使用中の場合は使用を控えてください。",
    listPrice: 13200,
  },
  {
    page: 23,
    slug: "drkozu-cell-peel-lift-up",
    name: "セルピール #リフトアップ",
    category: "スキンケア",
    summary: "角質ケア、バランス調整、セラム仕上げを順番に行う4回分のホームケアセット。",
    description: "1回分ずつ定量設計された4ステップのセットです。準備、角質ケア、バランス調整、セラム仕上げの順に使用し、使用後は十分な保湿と紫外線対策を行います。",
    highlights: ["4回分", "1回分ずつの定量設計", "4ステップケア", "保湿まで一式"],
    thirtySecondPitch: "角質ケア後の乾燥まで考えた4ステップ。使用順を示しながら紹介しやすいホームケアセットです。",
    demoInstructions: "セットの番号順に使用します。当日はスクラブ、強い酸、レチノールなど刺激の強いケアとの併用を避け、使用後は保湿と紫外線対策を行ってください。",
    targetAudience: "乾燥やハリ不足が気になり、角質ケアから保湿まで一連で取り入れたい方。",
    prohibitedClaims: "医療リフト、たるみ治療、乾燥小じわの改善保証等の断定はしないでください。刺激を感じた場合は使用を中止してください。",
    listPrice: 13200,
  },
  {
    page: 28,
    slug: "drkozu-repair-cleansing",
    name: "リペアクレンジング",
    category: "スキンケア",
    summary: "厚みのあるジェルで摩擦に配慮しながらメイクや皮脂をなじませて落とす、400gのクレンジング。",
    description: "乾いた手と顔に十分な量を取り、やさしくなじませてから洗い流すジェルクレンジングです。ブランドブックではホホバ、オリーブ、アルガンの3種の植物オイルなどの配合が紹介されています。",
    highlights: ["400g", "ジェルタイプ", "乾いた手と顔に使用", "3種の植物オイル配合"],
    thirtySecondPitch: "毎回たっぷり使いやすい400gサイズ。厚みのあるジェルで、摩擦に配慮したクレンジング習慣を提案できます。",
    demoInstructions: "乾いた手と顔に十分な量を取り、こすらずやさしくメイクとなじませてから、商品説明に従って十分に洗い流してください。",
    targetAudience: "クレンジング時の摩擦や洗い上がりの乾燥感が気になる方。",
    prohibitedClaims: "肌環境やバリア機能が必ず改善する、肌トラブルが治る等の断定はしないでください。",
    listPrice: 10780,
  },
  {
    page: 32,
    slug: "drkozu-repair-clear-wash",
    name: "リペアクリアウォッシュ",
    category: "スキンケア",
    summary: "きめ細かな泡で摩擦に配慮しながら洗う、120gの洗顔料。",
    description: "洗顔ネットで十分に泡立て、泡を転がすように洗う洗顔料です。ブランドブックでは乳酸菌発酵液、リンゴ果実培養細胞エキス、シロキクラゲ由来多糖体などの配合が紹介されています。",
    highlights: ["120g", "濃密泡", "洗顔ネットで泡立て", "摩擦に配慮した洗い方"],
    thirtySecondPitch: "濃密な泡を作る工程が見せやすい120gの洗顔料。指でこすらず、泡を転がす使い方を紹介できます。",
    demoInstructions: "洗顔ネットで十分に泡立て、泡を転がすようにやさしく洗い、商品説明に従って十分にすすいでください。",
    targetAudience: "泡立ちと摩擦に配慮した毎日の洗顔を重視する方。",
    prohibitedClaims: "毛穴汚れやくすみを根本から分解する、肌を再生する等の医療的・保証的な表現はしないでください。",
    listPrice: 5280,
  },
  {
    page: 36,
    slug: "drkozu-repair-serum",
    name: "リペアセラム",
    category: "スキンケア",
    summary: "洗顔・化粧水の後に顔全体へなじませる、40mLの美容液。",
    description: "洗顔後、化粧水で肌を整えた後に顔全体へなじませる美容液です。ブランドブックではナイアシンアミド、アデノシン、ヒアルロン酸、パンテノールなどの配合が紹介されています。",
    highlights: ["40mL", "洗顔・化粧水の後に使用", "顔全体へなじませる美容液", "日常の保湿ケア"],
    thirtySecondPitch: "毎日のスキンケアへ取り入れやすい40mLの美容液。テクスチャーとなじませ方を分かりやすく紹介できます。",
    demoInstructions: "洗顔後、化粧水で肌を整えた後、商品説明に従って適量を顔全体へやさしくなじませてください。",
    targetAudience: "乾燥やハリ不足が気になり、日常の美容液ケアを取り入れたい方。",
    prohibitedClaims: "ボトックスと同等、医療テクノロジーによる再生、シミ・シワ・毛穴・たるみ・ニキビが治る等の表現は使用しないでください。",
    listPrice: 12650,
  },
  {
    page: 40,
    slug: "drkozu-balance-gel",
    name: "バランスジェル",
    category: "スキンケア",
    summary: "セルピール後や乾燥が気になる時の保湿ケアに使う、弱酸性設計のジェル。",
    description: "セルピール後に適量を均一に塗布し、肌が落ち着いたことを確認して次のケアへ進むためのジェルです。乾燥や水分不足が気になる時の保湿ジェルとしても案内されています。容量はブランドブックに明記されていないため未掲載です。",
    highlights: ["セルピール後のケア", "弱酸性設計", "保湿ジェルとしても使用", "容量は要確認"],
    thirtySecondPitch: "角質ケアの後に水分と快適な使用感をつなぐバランスジェル。セルピールと組み合わせた手順を紹介できます。",
    demoInstructions: "セルピール後、商品説明に従って適量を均一に塗布します。刺激やほてりを効果の証拠とせず、違和感がある場合は使用を中止してください。",
    targetAudience: "セルピール後の保湿ケア、または乾燥が気になる時のジェルケアを探している方。",
    prohibitedClaims: "刺激やほてりを効いている証拠と説明しないでください。鎮静・修復・治療効果を保証する表現は使用しないでください。",
    listPrice: 5390,
  },
  {
    page: 43,
    slug: "drkozu-repair-facial-mask",
    name: "リペアフェイシャルマスク",
    category: "スキンケア",
    summary: "1枚に美容液28mLを含んだ、5枚入りの集中保湿シートマスク。",
    description: "洗顔後に肌を整えてから顔全体へ密着させるシートマスクです。パッケージ記載の時間を目安に外し、残った美容液を顔、首、デコルテへやさしくなじませます。",
    highlights: ["28mL×5枚", "集中保湿シートマスク", "顔・首・デコルテへ", "密着タイプ"],
    thirtySecondPitch: "1枚に美容液28mLを含んだ5枚入りシートマスク。取り出し方から密着感まで、ライブで分かりやすく紹介できます。",
    demoInstructions: "洗顔後、肌を整えてからシートを広げて顔全体へ密着させます。パッケージ記載の時間を守り、完全に乾くまで長時間使用しないでください。",
    targetAudience: "乾燥が気になる時に、手軽な集中保湿ケアを取り入れたい方。",
    prohibitedClaims: "バリア機能が必ず改善する、肌トラブルが治る等の断定はしないでください。使用時間はパッケージ表示を優先してください。",
    listPrice: 6160,
  },
  {
    page: 44,
    slug: "drkozu-cinderella-mask",
    name: "シンデレラマスク",
    category: "スキンケア",
    summary: "精製水と混ぜて塗布し、約20分後に一枚ではがす30g×5回分のモデリングマスク。",
    description: "パッケージ記載の比率で精製水を加え、均一なペースト状にして塗布するモデリングマスクです。眉、髪の生え際、目元、口元を避け、約20分後に固まったらあご先からはがします。",
    highlights: ["30g×5回分", "混ぜて使うタイプ", "約20分", "一枚ではがすモデリングマスク"],
    thirtySecondPitch: "混ぜる、塗る、固まる、はがすという工程が映像で伝わりやすい、5回分のモデリングマスクです。",
    demoInstructions: "パッケージ記載の比率で精製水を加えて均一なペースト状にし、眉・髪の生え際・目元・口元を避けてやや厚めに塗布します。約20分後、固まったらあご先からはがし、その後は保湿します。",
    targetAudience: "自宅で工程を楽しむ集中ケアや、体験型のライブデモを取り入れたい方。",
    prohibitedClaims: "サロン施術と同一の効果、透明感や肌改善の保証はしないでください。使用方法と放置時間は商品表示を優先してください。",
    listPrice: 15500,
  },
  {
    page: 45,
    slug: "drkozu-repair-lip-serum",
    name: "リペアリップセラム",
    category: "メイク・コスメ",
    summary: "リップケアとツヤのあるメイク効果を1本で楽しめる、全5色のリップセラム。",
    description: "まず薄く塗って温感を確認し、必要に応じて重ねるリップセラムです。ブランドブックではバニリルブチル、トコフェロール、植物由来エモリエント成分などの配合が紹介されています。",
    highlights: ["全5色", "温感タイプ", "リップケアとメイク効果", "単独・重ね使いに対応"],
    thirtySecondPitch: "全5色から選べるリップセラム。薄く塗って温感を確認し、ツヤや色の見え方をライブで紹介できます。",
    demoInstructions: "まず薄く塗って温感を確認し、必要に応じて重ねます。強い刺激や異常を感じた場合は使用を中止してください。",
    targetAudience: "うるおい感、ツヤ、カラーを1本で楽しみたい方。",
    prohibitedClaims: "唇の体積増加や血行改善を保証しないでください。温感には個人差があり、強い刺激を感じた場合は使用を中止してください。",
    listPrice: 3850,
  },
] as const;

function sourceReference(page: number): string {
  return `drkozu-brand-book-2026-v5:p${page}`;
}

async function sha256File(path: string): Promise<{ sha256: string; size: number }> {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) throw new Error("DRKOZU_LCM_SOURCE_NOT_FILE");
  const content = await readFile(path);
  return { sha256: createHash("sha256").update(content).digest("hex"), size: fileStat.size };
}

export async function verifyDrKozuLcmSources(): Promise<void> {
  const pdf = await sha256File(SOURCE_PDF_PATH);
  if (pdf.size !== SOURCE_PDF_SIZE) throw new Error("DRKOZU_LCM_PDF_SIZE_MISMATCH");
  if (pdf.sha256 !== SOURCE_PDF_SHA256) throw new Error("DRKOZU_LCM_PDF_HASH_MISMATCH");
  for (const [name, expected] of Object.entries(ASSET_SHA256)) {
    const asset = await sha256File(resolve(ASSET_ROOT, name));
    if (asset.sha256 !== expected) throw new Error(`DRKOZU_LCM_ASSET_HASH_MISMATCH:${name}`);
  }
}

async function ensureMarkerTable(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS lcm_content_bootstrap_runs (
    bootstrapKey VARCHAR(120) NOT NULL PRIMARY KEY,
    sourceSha256 CHAR(64) NOT NULL,
    status ENUM('running','completed','failed') NOT NULL,
    accountId INT NULL,
    brandProfileId INT NULL,
    productCount INT NOT NULL DEFAULT 0,
    errorCode VARCHAR(120) NULL,
    completedAt TIMESTAMP NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function resolveSourceBrandId(connection: PoolConnection): Promise<number> {
  const [brandRows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM brands
      WHERE deletedAt IS NULL
        AND LOWER(REPLACE(REPLACE(TRIM(name), '.', ''), ' ', ''))='drkozu'
      ORDER BY id`,
  );
  if (brandRows.length !== 1) throw new Error("DRKOZU_LCM_SOURCE_BRAND_NOT_UNIQUE");
  const sourceBrandId = Number(brandRows[0].id);
  const [storeRows] = await connection.query<RowDataPacket[]>(
    `SELECT id FROM managed_stores WHERE isActive=1 AND LOWER(TRIM(name))='buzzdrop' ORDER BY id`,
  );
  if (storeRows.length !== 1) throw new Error("DRKOZU_LCM_BUZZDROP_STORE_NOT_UNIQUE");
  const [relationRows] = await connection.query<RowDataPacket[]>(
    `SELECT 1 AS linked FROM managed_store_brands WHERE storeId=? AND brandId=? LIMIT 1`,
    [Number(storeRows[0].id), sourceBrandId],
  );
  if (!relationRows.length) throw new Error("DRKOZU_LCM_SOURCE_RELATION_MISSING");
  return sourceBrandId;
}

async function completedStateIsPresent(connection: PoolConnection): Promise<{ completed: boolean; accountId?: number; brandProfileId?: number }> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT run.accountId,run.brandProfileId,run.productCount,
            EXISTS(SELECT 1 FROM festival_accounts account
                    WHERE account.id=run.accountId AND LOWER(TRIM(account.email))=? AND account.account_type='company'
                      AND account.role='applicant' AND account.is_active=1) AS accountPresent,
            EXISTS(SELECT 1 FROM lcm_memberships membership
                    WHERE membership.festivalAccountId=run.accountId AND membership.memberType='company'
                      AND membership.status='approved') AS membershipPresent,
            EXISTS(SELECT 1 FROM lcm_brand_profiles brand
                    WHERE brand.id=run.brandProfileId AND brand.sourceCatalogPage=? AND brand.status='published'
                      AND brand.claimStatus='claimed' AND brand.createdByAccountId=run.accountId) AS brandPresent,
            (SELECT COUNT(*) FROM lcm_brand_members member
              WHERE member.brandProfileId=run.brandProfileId AND member.festivalAccountId=run.accountId
                AND member.role='owner' AND member.status='active') AS activeOwnerCount,
            (SELECT COUNT(*) FROM lcm_brand_members member
              WHERE member.brandProfileId=run.brandProfileId AND member.status IN ('pending','active')
                AND member.festivalAccountId<>run.accountId) AS conflictingMemberCount,
            (SELECT COUNT(*) FROM lcm_brand_event_participations participation
              WHERE participation.brandProfileId=run.brandProfileId AND participation.eventKey='2026-01'
                AND participation.eventLabel='第1回LCF 出展実績'
                AND participation.archivePath='/livecommercefestival/2026/exhibitors'
                AND participation.verificationSource='lcf_catalog' AND participation.sourceReference='catalog-page-31') AS eventParticipationCount,
            (SELECT COUNT(*) FROM lcm_products product
              WHERE product.brandProfileId=run.brandProfileId AND product.sourceKind='brand'
                AND product.status='published' AND product.createdByAccountId=run.accountId
                AND product.sourceReference IN (
                  'drkozu-brand-book-2026-v5:p14','drkozu-brand-book-2026-v5:p18','drkozu-brand-book-2026-v5:p22',
                  'drkozu-brand-book-2026-v5:p23','drkozu-brand-book-2026-v5:p28','drkozu-brand-book-2026-v5:p32',
                  'drkozu-brand-book-2026-v5:p36','drkozu-brand-book-2026-v5:p40','drkozu-brand-book-2026-v5:p43',
                  'drkozu-brand-book-2026-v5:p44','drkozu-brand-book-2026-v5:p45'
                )) AS productsPresent
       FROM lcm_content_bootstrap_runs run
      WHERE run.bootstrapKey=? AND run.sourceSha256=? AND run.status='completed' LIMIT 1`,
    [DRKOZU_LCM_ACCOUNT_EMAIL, SOURCE_CATALOG_PAGE, DRKOZU_LCM_BOOTSTRAP_KEY, SOURCE_PDF_SHA256],
  );
  if (!rows.length) return { completed: false };
  const row = rows[0];
  const healthy = Number(row.accountPresent) === 1
    && Number(row.membershipPresent) === 1
    && Number(row.brandPresent) === 1
    && Number(row.activeOwnerCount) === 1
    && Number(row.conflictingMemberCount) === 0
    && Number(row.eventParticipationCount) === 1
    && Number(row.productsPresent) === DRKOZU_LCM_PRODUCTS.length
    && Number(row.productCount) === DRKOZU_LCM_PRODUCTS.length;
  if (!healthy) throw new Error("DRKOZU_LCM_COMPLETED_STATE_INCONSISTENT");
  return { completed: true, accountId: Number(row.accountId), brandProfileId: Number(row.brandProfileId) };
}

async function insertAudit(
  connection: PoolConnection,
  entityType: string,
  entityId: number,
  action: string,
  after: Record<string, unknown>,
): Promise<void> {
  await connection.query(
    `INSERT INTO lcm_audit_logs (actorAccountId,actorRole,entityType,entityId,action,beforeJson,afterJson)
     VALUES (NULL,'system',?,?,?,NULL,?)`,
    [entityType, String(entityId), action, JSON.stringify(after)],
  );
}

async function createAccount(connection: PoolConnection): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id,email,account_type AS accountType,role,application_id AS applicationId,display_name AS displayName,is_active AS isActive
       FROM festival_accounts WHERE LOWER(TRIM(email))=? FOR UPDATE`,
    [DRKOZU_LCM_ACCOUNT_EMAIL],
  );
  if (rows.length) throw new Error("DRKOZU_LCM_ACCOUNT_COLLISION");
  const [result] = await connection.query<ResultSetHeader>(
    `INSERT INTO festival_accounts
      (email,password_hash,account_type,role,application_id,display_name,is_active,auth_version)
     VALUES (?,?,'company','applicant',NULL,'Dr.Kozu',1,1)`,
    [DRKOZU_LCM_ACCOUNT_EMAIL, DRKOZU_LCM_INITIAL_PASSWORD_HASH],
  );
  const accountId = Number(result.insertId);
  if (!accountId) throw new Error("DRKOZU_LCM_ACCOUNT_INSERT_FAILED");
  await connection.query(
    `INSERT INTO festival_activity_logs (account_id,account_email,account_type,action,details,ip_address,user_agent)
     VALUES (?,?,'company','system_initialized_lcm_brand',?,NULL,NULL)`,
    [accountId, DRKOZU_LCM_ACCOUNT_EMAIL, JSON.stringify({ bootstrapKey: DRKOZU_LCM_BOOTSTRAP_KEY, credentialLogged: false })],
  );
  return accountId;
}

async function createMembership(connection: PoolConnection, accountId: number): Promise<number> {
  const [result] = await connection.query<ResultSetHeader>(
    `INSERT INTO lcm_memberships
      (festivalAccountId,memberType,displayName,businessName,status,termsVersion,agreedAt,reviewedBy,reviewedAt,reviewNote)
     VALUES (?,'company','Dr.Kozu','株式会社Dr.Kozu','approved',?,CURRENT_TIMESTAMP,NULL,CURRENT_TIMESTAMP,
             'ユーザー承認済みのDr.Kozu初期登録。共通Festival Accountと同一会員台帳で管理')`,
    [accountId, LCM_TERMS_VERSION],
  );
  const membershipId = Number(result.insertId);
  if (!membershipId) throw new Error("DRKOZU_LCM_MEMBERSHIP_INSERT_FAILED");
  await insertAudit(connection, "membership", membershipId, "system_bootstrap_created", {
    bootstrapKey: DRKOZU_LCM_BOOTSTRAP_KEY,
    festivalAccountId: accountId,
    memberType: "company",
    status: "approved",
    credentialLogged: false,
  });
  return membershipId;
}

async function createBrand(connection: PoolConnection, accountId: number, sourceBrandId: number): Promise<number> {
  const [candidates] = await connection.query<RowDataPacket[]>(
    `SELECT id,slug,sourceBrandId,sourceCatalogPage,displayName,companyName,status,claimStatus,createdByAccountId
       FROM lcm_brand_profiles
      WHERE sourceBrandId=? OR sourceCatalogPage=? OR slug='dr-kozu'
         OR LOWER(REPLACE(REPLACE(TRIM(displayName), '.', ''), ' ', ''))='drkozu'
      FOR UPDATE`,
    [sourceBrandId, SOURCE_CATALOG_PAGE],
  );
  if (candidates.length > 1) throw new Error("DRKOZU_LCM_TARGET_BRAND_NOT_UNIQUE");
  if (candidates.length === 1) {
    const existing = candidates[0];
    const [members] = await connection.query<RowDataPacket[]>(
      `SELECT festivalAccountId,status FROM lcm_brand_members WHERE brandProfileId=? FOR UPDATE`,
      [Number(existing.id)],
    );
    if (members.length > 0) throw new Error("DRKOZU_LCM_EXISTING_BRAND_ALREADY_OWNED");
    if (existing.sourceCatalogPage != null && Number(existing.sourceCatalogPage) !== SOURCE_CATALOG_PAGE) {
      throw new Error("DRKOZU_LCM_EXISTING_BRAND_CATALOG_MISMATCH");
    }
    if (existing.sourceBrandId != null && Number(existing.sourceBrandId) !== sourceBrandId) {
      throw new Error("DRKOZU_LCM_EXISTING_BRAND_SOURCE_MISMATCH");
    }
    throw new Error("DRKOZU_LCM_EXISTING_BRAND_REQUIRES_ADMIN_RECONCILIATION");
  }
  const [result] = await connection.query<ResultSetHeader>(
    `INSERT INTO lcm_brand_profiles
      (slug,sourceBrandId,sourceCatalogPage,displayName,companyName,category,tagline,description,story,logoUrl,coverUrl,
       officialWebsiteUrl,tiktokShopUrl,amazonUrl,rakutenUrl,otherSalesUrl,status,claimStatus,createdByAccountId,
       submittedAt,publishedAt,reviewedBy,reviewedAt,rejectionReason)
     VALUES ('dr-kozu',?,?,'Dr.Kozu','株式会社Dr.Kozu','スキンケア・美容',
       'プロのサロンケア発想を、毎日のホームケアへ。',
       '美容サロンの現場経験をもとに、洗浄、整肌、角質ケア、集中ケア、インナーケアを日常へ取り入れやすく再構築するブランドです。',
       'Dr.Kozuは、創業者が18年間にわたり美容サロンの現場で積み重ねた知識と経験から生まれました。滋賀・京都の直営サロンで得た使用感や使いやすさの声を製品開発と改善へ活かし、分かりやすく続けられるケアを目指しています。',
       ?,?,NULL,NULL,NULL,NULL,NULL,'published','claimed',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,NULL,NULL)`,
    [sourceBrandId, SOURCE_CATALOG_PAGE, `${PUBLIC_ASSET_ROOT}/brand-logo.webp`, `${PUBLIC_ASSET_ROOT}/brand-cover.webp`, accountId],
  );
  const brandProfileId = Number(result.insertId);
  if (!brandProfileId) throw new Error("DRKOZU_LCM_BRAND_INSERT_FAILED");
  await insertAudit(connection, "brand", brandProfileId, "system_bootstrap_created", {
    bootstrapKey: DRKOZU_LCM_BOOTSTRAP_KEY,
    sourceBrandId,
    sourceCatalogPage: SOURCE_CATALOG_PAGE,
    status: "published",
    claimStatus: "claimed",
  });
  return brandProfileId;
}

async function createBrandMembership(connection: PoolConnection, accountId: number, brandProfileId: number): Promise<void> {
  const [result] = await connection.query<ResultSetHeader>(
    `INSERT INTO lcm_brand_members
      (brandProfileId,festivalAccountId,role,status,approvedBy,approvedAt)
     VALUES (?,?,'owner','active',NULL,CURRENT_TIMESTAMP)`,
    [brandProfileId, accountId],
  );
  const brandMemberId = Number(result.insertId);
  if (!brandMemberId) throw new Error("DRKOZU_LCM_BRAND_MEMBER_INSERT_FAILED");
  await insertAudit(connection, "brand_claim", brandMemberId, "system_bootstrap_activated", {
    bootstrapKey: DRKOZU_LCM_BOOTSTRAP_KEY,
    brandProfileId,
    festivalAccountId: accountId,
    role: "owner",
    status: "active",
  });
}

async function createFirstEditionParticipation(connection: PoolConnection, brandProfileId: number): Promise<void> {
  const [result] = await connection.query<ResultSetHeader>(
    `INSERT INTO lcm_brand_event_participations
      (brandProfileId,eventKey,eventLabel,archivePath,verificationSource,sourceReference,verifiedByAccountId,verifiedAt)
     VALUES (?,'2026-01','第1回LCF 出展実績','/livecommercefestival/2026/exhibitors','lcf_catalog','catalog-page-31',NULL,CURRENT_TIMESTAMP)`,
    [brandProfileId],
  );
  const participationId = Number(result.insertId);
  if (!participationId) throw new Error("DRKOZU_LCM_EVENT_PARTICIPATION_INSERT_FAILED");
  await insertAudit(connection, "brand_event_participation", participationId, "system_bootstrap_created", {
    bootstrapKey: DRKOZU_LCM_BOOTSTRAP_KEY,
    brandProfileId,
    eventKey: "2026-01",
    verificationSource: "lcf_catalog",
    sourceReference: `catalog-page-${SOURCE_CATALOG_PAGE}`,
  });
}

async function createProducts(connection: PoolConnection, accountId: number, brandProfileId: number): Promise<number> {
  let created = 0;
  for (const product of DRKOZU_LCM_PRODUCTS) {
    const reference = sourceReference(product.page);
    const [existingSource] = await connection.query<RowDataPacket[]>(
      `SELECT id,brandProfileId FROM lcm_products WHERE sourceKind='brand' AND sourceReference=? FOR UPDATE`,
      [reference],
    );
    if (existingSource.length) throw new Error(`DRKOZU_LCM_PRODUCT_SOURCE_COLLISION:p${product.page}`);
    const [existingSlug] = await connection.query<RowDataPacket[]>(
      `SELECT id FROM lcm_products WHERE slug=? FOR UPDATE`,
      [product.slug],
    );
    if (existingSlug.length) throw new Error(`DRKOZU_LCM_PRODUCT_SLUG_COLLISION:p${product.page}`);
    const imageUrl = `${PUBLIC_ASSET_ROOT}/p${product.page}-product.webp`;
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO lcm_products
        (brandProfileId,slug,sku,name,category,summary,description,highlights,thirtySecondPitch,demoInstructions,targetAudience,prohibitedClaims,
         relatedProductsText,listPrice,currency,taxMode,wholesalePrice,wholesaleMinQuantity,wholesaleShippingTerms,wholesalePaymentTerms,
         wholesaleValidUntil,commissionRate,sampleAvailable,sampleMonthlyLimit,sampleInstructions,stockDisclosure,stockQuantity,primaryImageUrl,
         imageUrls,imageKeys,officialProductUrl,tiktokShopUrl,amazonUrl,rakutenUrl,status,sourceKind,sourceReference,createdByAccountId,
         submittedAt,publishedAt,reviewedBy,reviewedAt,rejectionReason)
       VALUES (?,?,NULL,?,?,?,?,?,?,?,?,?,NULL,?,'JPY','unknown',NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'hidden',NULL,?,
               JSON_ARRAY(),JSON_ARRAY(),NULL,NULL,NULL,NULL,'published','brand',?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL,NULL,NULL)`,
      [
        brandProfileId,
        product.slug,
        product.name,
        product.category,
        product.summary,
        product.description,
        JSON.stringify(product.highlights),
        product.thirtySecondPitch,
        product.demoInstructions,
        product.targetAudience,
        product.prohibitedClaims,
        product.listPrice,
        imageUrl,
        reference,
        accountId,
      ],
    );
    const productId = Number(result.insertId);
    if (!productId) throw new Error(`DRKOZU_LCM_PRODUCT_INSERT_FAILED:p${product.page}`);
    await insertAudit(connection, "product", productId, "system_bootstrap_created", {
      bootstrapKey: DRKOZU_LCM_BOOTSTRAP_KEY,
      brandProfileId,
      sourceReference: reference,
      sourcePdfSha256: SOURCE_PDF_SHA256,
      sourcePage: product.page,
      status: "published",
      sampleAvailable: false,
      wholesaleTermsPresent: false,
      stockDisclosure: "hidden",
    });
    created += 1;
  }
  return created;
}

export type DrKozuLcmBootstrapResult = {
  status: "completed" | "already_completed" | "busy";
  accountId?: number;
  brandProfileId?: number;
  productCount?: number;
};

async function runDrKozuLcmBootstrap(): Promise<DrKozuLcmBootstrapResult> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for Dr.Kozu LCM bootstrap");
  bootstrapStage = "source_validation";
  await verifyDrKozuLcmSources();
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 2 });
  let lockConnection: PoolConnection | null = null;
  try {
    bootstrapStage = "marker_table";
    await ensureMarkerTable(pool);
    bootstrapStage = "acquire_lock";
    lockConnection = await pool.getConnection();
    const [lockRows] = await lockConnection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 0) AS acquired", [LOCK_NAME]);
    if (Number(lockRows[0]?.acquired) !== 1) return { status: "busy" };
    bootstrapStage = "completed_state";
    const completed = await completedStateIsPresent(lockConnection);
    if (completed.completed) {
      return { status: "already_completed", accountId: completed.accountId, brandProfileId: completed.brandProfileId, productCount: DRKOZU_LCM_PRODUCTS.length };
    }

    await lockConnection.beginTransaction();
    try {
      bootstrapStage = "marker_running";
      await lockConnection.query(
        `INSERT INTO lcm_content_bootstrap_runs (bootstrapKey,sourceSha256,status,productCount,errorCode,completedAt)
         VALUES (?,?,'running',0,NULL,NULL)
         ON DUPLICATE KEY UPDATE status='running',sourceSha256=VALUES(sourceSha256),productCount=0,errorCode=NULL,completedAt=NULL`,
        [DRKOZU_LCM_BOOTSTRAP_KEY, SOURCE_PDF_SHA256],
      );
      bootstrapStage = "source_relation";
      const sourceBrandId = await resolveSourceBrandId(lockConnection);
      bootstrapStage = "account";
      const accountId = await createAccount(lockConnection);
      bootstrapStage = "membership";
      await createMembership(lockConnection, accountId);
      bootstrapStage = "brand";
      const brandProfileId = await createBrand(lockConnection, accountId, sourceBrandId);
      bootstrapStage = "brand_owner";
      await createBrandMembership(lockConnection, accountId, brandProfileId);
      bootstrapStage = "event_participation";
      await createFirstEditionParticipation(lockConnection, brandProfileId);
      bootstrapStage = "products";
      const productCount = await createProducts(lockConnection, accountId, brandProfileId);
      bootstrapStage = "marker_completed";
      await lockConnection.query(
        `UPDATE lcm_content_bootstrap_runs
            SET status='completed',accountId=?,brandProfileId=?,productCount=?,errorCode=NULL,completedAt=CURRENT_TIMESTAMP
          WHERE bootstrapKey=? AND sourceSha256=? AND status='running'`,
        [accountId, brandProfileId, productCount, DRKOZU_LCM_BOOTSTRAP_KEY, SOURCE_PDF_SHA256],
      );
      await lockConnection.commit();
      return { status: "completed", accountId, brandProfileId, productCount };
    } catch (error) {
      await lockConnection.rollback();
      const errorCode = safeBootstrapFailureCode(error);
      await lockConnection.query(
        `INSERT INTO lcm_content_bootstrap_runs (bootstrapKey,sourceSha256,status,productCount,errorCode,completedAt)
         VALUES (?,?,'failed',0,?,NULL)
         ON DUPLICATE KEY UPDATE status='failed',productCount=0,errorCode=VALUES(errorCode),completedAt=NULL`,
        [DRKOZU_LCM_BOOTSTRAP_KEY, SOURCE_PDF_SHA256, errorCode],
      ).catch(() => undefined);
      throw error;
    }
  } finally {
    if (lockConnection) {
      await lockConnection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
      lockConnection.release();
    }
    await pool.end();
  }
}

export async function bootstrapDrKozuLcmBrand(): Promise<DrKozuLcmBootstrapResult> {
  setBootstrapRuntime("running", "starting");
  try {
    const result = await runDrKozuLcmBootstrap();
    if (result.status === "busy") {
      setBootstrapRuntime("pending", "lock_busy");
    } else {
      setBootstrapRuntime("completed", result.status);
    }
    return result;
  } catch (error) {
    const failureCode = safeBootstrapFailureCode(error);
    setBootstrapRuntime("failed", bootstrapStage, failureCode);
    throw error;
  }
}

export async function getDrKozuLcmBootstrapHealth(): Promise<{
  ok: boolean;
  runtimeState: BootstrapRuntimeState;
  stage: string;
  markerStatus: "running" | "completed" | "failed" | "missing" | "unavailable";
  productCount: number;
  failureCode: string | null;
  updatedAt: string;
}> {
  let markerStatus: "running" | "completed" | "failed" | "missing" | "unavailable" = "unavailable";
  let productCount = 0;
  let markerFailureCode: string | null = null;
  if (process.env.DATABASE_URL) {
    const pool = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 1 });
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT status,productCount,errorCode,accountId,brandProfileId
           FROM lcm_content_bootstrap_runs
          WHERE bootstrapKey=? AND sourceSha256=? LIMIT 1`,
        [DRKOZU_LCM_BOOTSTRAP_KEY, SOURCE_PDF_SHA256],
      );
      const row = rows[0];
      markerStatus = row ? String(row.status) as "running" | "completed" | "failed" : "missing";
      productCount = Number(row?.productCount || 0);
      const storedError = String(row?.errorCode || "");
      markerFailureCode = /^DRKOZU_LCM_[A-Za-z0-9_:.-]+$/.test(storedError) ? storedError : storedError ? "DRKOZU_LCM_STORED_FAILURE" : null;
      if (markerStatus === "completed" && (!row?.accountId || !row?.brandProfileId || productCount !== DRKOZU_LCM_PRODUCTS.length)) {
        markerFailureCode = "DRKOZU_LCM_COMPLETED_MARKER_INVALID";
      }
    } catch {
      markerStatus = "unavailable";
    } finally {
      await pool.end();
    }
  }
  const ok = markerStatus === "completed" && productCount === DRKOZU_LCM_PRODUCTS.length && !markerFailureCode;
  return {
    ok,
    runtimeState: bootstrapRuntime.state,
    stage: bootstrapStage,
    markerStatus,
    productCount,
    failureCode: bootstrapRuntime.failureCode || markerFailureCode,
    updatedAt: bootstrapRuntime.updatedAt,
  };
}
