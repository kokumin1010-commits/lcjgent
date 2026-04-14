/**
 * AitherHub Brand Sync — LCJ Mall → AitherHub widget_clients 自動同期
 *
 * ブランドの作成・更新・削除時にAitherHubのAPIを呼び出し、
 * widget_clientsレコードを自動的に作成/更新する。
 *
 * 環境変数:
 *   AITHERHUB_API_URL — AitherHub APIのベースURL（デフォルト: https://aitherhubapi-cpcjcnezbgf5f7e2.japaneast-01.azurewebsites.net/api/v1）
 *   BRAND_SYNC_SECRET — 同期認証用シークレット（デフォルト: aitherhub-brand-sync-2026）
 */

const AITHERHUB_API_URL = process.env.AITHERHUB_API_URL
  || "https://aitherhubapi-cpcjcnezbgf5f7e2.japaneast-01.azurewebsites.net/api/v1";
const BRAND_SYNC_SECRET = process.env.BRAND_SYNC_SECRET || "aitherhub-brand-sync-2026";

interface BrandSyncPayload {
  lcj_brand_id: number;
  name: string;
  name_ja?: string;
  company_name?: string;
  category?: string;
  logo_url?: string;
  email?: string;
  contact_person?: string;
  status?: string;
  action: "upsert" | "delete";
}

interface BrandSyncResult {
  success: boolean;
  client_id?: string;
  action?: string;
  message?: string;
  portal_url?: string;
  password?: string;
}

/**
 * AitherHubにブランドを同期（作成/更新）
 * 非同期で実行し、失敗してもLCJ Mall側の処理を止めない
 */
export async function syncBrandToAitherhub(payload: BrandSyncPayload): Promise<BrandSyncResult | null> {
  try {
    console.log(`[AitherHub Brand Sync] Syncing brand #${payload.lcj_brand_id} (${payload.name}) — action: ${payload.action}`);

    const response = await fetch(`${AITHERHUB_API_URL}/sync/brand`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sync-Secret": BRAND_SYNC_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000), // 15秒タイムアウト
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[AitherHub Brand Sync] HTTP ${response.status}: ${errorText}`);
      return { success: false, message: `HTTP ${response.status}: ${errorText}` };
    }

    const result: BrandSyncResult = await response.json();
    console.log(`[AitherHub Brand Sync] Result:`, JSON.stringify(result));

    // 新規作成時はパスワードをログに記録（セキュリティ注意：本番ではログレベルを調整）
    if (result.password) {
      console.log(`[AitherHub Brand Sync] New brand portal created:`);
      console.log(`  - Client ID: ${result.client_id}`);
      console.log(`  - Portal URL: ${result.portal_url}`);
      console.log(`  - Password: ${result.password}`);
    }

    return result;
  } catch (error: any) {
    console.error(`[AitherHub Brand Sync] Error syncing brand #${payload.lcj_brand_id}:`, error.message || error);
    return null;
  }
}

/**
 * ブランド作成時のAitherHub同期
 */
export async function onBrandCreated(brand: {
  id: number;
  name: string;
  nameJa?: string | null;
  companyName?: string | null;
  category?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  status?: string | null;
}): Promise<BrandSyncResult | null> {
  return syncBrandToAitherhub({
    lcj_brand_id: brand.id,
    name: brand.name,
    name_ja: brand.nameJa || undefined,
    company_name: brand.companyName || undefined,
    category: brand.category || undefined,
    logo_url: brand.logoUrl || undefined,
    email: brand.email || undefined,
    contact_person: brand.contactPerson || undefined,
    status: brand.status || "進行中",
    action: "upsert",
  });
}

/**
 * ブランド更新時のAitherHub同期
 */
export async function onBrandUpdated(brand: {
  id: number;
  name: string;
  nameJa?: string | null;
  companyName?: string | null;
  category?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  status?: string | null;
}): Promise<BrandSyncResult | null> {
  return syncBrandToAitherhub({
    lcj_brand_id: brand.id,
    name: brand.name,
    name_ja: brand.nameJa || undefined,
    company_name: brand.companyName || undefined,
    category: brand.category || undefined,
    logo_url: brand.logoUrl || undefined,
    email: brand.email || undefined,
    contact_person: brand.contactPerson || undefined,
    status: brand.status || "進行中",
    action: "upsert",
  });
}

/**
 * ブランド削除時のAitherHub同期（無効化）
 */
export async function onBrandDeleted(brandId: number, brandName: string): Promise<BrandSyncResult | null> {
  return syncBrandToAitherhub({
    lcj_brand_id: brandId,
    name: brandName,
    action: "delete",
  });
}

/**
 * 一括同期 — 全ブランドをAitherHubに同期
 * 管理画面から手動で実行する用途
 */
export async function bulkSyncBrandsToAitherhub(brands: Array<{
  id: number;
  name: string;
  nameJa?: string | null;
  companyName?: string | null;
  category?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  status?: string | null;
}>): Promise<any> {
  try {
    console.log(`[AitherHub Brand Sync] Bulk syncing ${brands.length} brands...`);

    const payload = {
      brands: brands.map(b => ({
        lcj_brand_id: b.id,
        name: b.name,
        name_ja: b.nameJa || undefined,
        company_name: b.companyName || undefined,
        category: b.category || undefined,
        logo_url: b.logoUrl || undefined,
        email: b.email || undefined,
        contact_person: b.contactPerson || undefined,
        status: b.status || "進行中",
        action: "upsert" as const,
      })),
    };

    const response = await fetch(`${AITHERHUB_API_URL}/sync/brands/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sync-Secret": BRAND_SYNC_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000), // 60秒タイムアウト
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[AitherHub Brand Sync] Bulk sync HTTP ${response.status}: ${errorText}`);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const result = await response.json();
    console.log(`[AitherHub Brand Sync] Bulk sync result:`, JSON.stringify(result));
    return result;
  } catch (error: any) {
    console.error(`[AitherHub Brand Sync] Bulk sync error:`, error.message || error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

/**
 * AitherHub同期ステータスを取得
 */
export async function getAitherhubSyncStatus(): Promise<any> {
  try {
    const response = await fetch(`${AITHERHUB_API_URL}/sync/brands/status`, {
      method: "GET",
      headers: {
        "X-Sync-Secret": BRAND_SYNC_SECRET,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[AitherHub Brand Sync] Status check error:`, error.message || error);
    return { success: false, error: error.message || "Unknown error" };
  }
}
