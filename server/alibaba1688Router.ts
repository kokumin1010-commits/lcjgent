/**
 * 1688 API Integration Router
 * Namespace: com.alibaba.fenxiao.crossborder
 * APIs: keyword search, product detail, product analytics
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

const APP_KEY = process.env.ALIBABA_1688_APP_KEY || "7138022";
const APP_SECRET = process.env.ALIBABA_1688_APP_SECRET || "AvexeW1Avl9y";
const ACCESS_TOKEN = process.env.ALIBABA_1688_ACCESS_TOKEN || "85e6fb23-0ea5-4cdf-bffb-fceacb2df75d";
const NAMESPACE = "com.alibaba.fenxiao.crossborder";
const BASE_URL = "https://gw.open.1688.com/openapi";

/**
 * Generate 1688 API signature
 */
function generateSignature(apiPath: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let signStr = apiPath;
  for (const k of sortedKeys) {
    signStr += k + params[k];
  }
  return crypto.createHmac("sha1", APP_SECRET).update(signStr, "utf8").digest("hex").toUpperCase();
}

/**
 * Call 1688 API
 */
async function call1688Api(apiName: string, businessParams: Record<string, any>): Promise<any> {
  const apiPath = `param2/1/${NAMESPACE}/${apiName}/${APP_KEY}`;
  
  const params: Record<string, string> = {
    access_token: ACCESS_TOKEN,
  };
  
  // Add business params (they need to be JSON stringified for complex params)
  for (const [key, value] of Object.entries(businessParams)) {
    params[key] = typeof value === "object" ? JSON.stringify(value) : String(value);
  }
  
  const signature = generateSignature(apiPath, params);
  const postData = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&") + `&_aop_signature=${signature}`;
  
  const url = `${BASE_URL}/${apiPath}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: postData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `1688 API error (${response.status}): ${errorText}`,
    });
  }
  
  return response.json();
}

/**
 * Extract product ID from 1688 URL
 * Supports formats:
 * - https://detail.1688.com/offer/925419987602.html
 * - https://m.1688.com/offer/925419987602.html
 * - 925419987602 (plain ID)
 */
function extractProductId(input: string): string | null {
  // Plain number
  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }
  // URL with offer ID
  const match = input.match(/offer\/(\d+)/);
  if (match) return match[1];
  // URL with offerId param
  const paramMatch = input.match(/offerId=(\d+)/);
  if (paramMatch) return paramMatch[1];
  return null;
}

export const alibaba1688Router = router({
  /**
   * Search products by keyword
   */
  searchProducts: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1, "关键词不能为空"),
      page: z.number().default(1),
      pageSize: z.number().default(20),
      country: z.string().default("zh"),
    }))
    .mutation(async ({ input }) => {
      const result = await call1688Api("product.search.keywordQuery", {
        offerQueryParam: {
          keyword: input.keyword,
          country: input.country,
          beginPage: input.page,
          pageSize: input.pageSize,
        },
      });
      
      if (!result.result?.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.result?.message || "搜索失败",
        });
      }
      
      const data = result.result.result?.data || [];
      return {
        total: result.result.result?.totalRecords || 0,
        totalPage: result.result.result?.totalPage || 0,
        currentPage: result.result.result?.currentPage || input.page,
        items: data.map((item: any) => ({
          offerId: String(item.offerId),
          title: item.subject,
          titleTranslated: item.subjectTrans,
          imageUrl: item.imageUrl,
          price: item.priceInfo?.price || item.priceInfo?.consignPrice || "0",
          monthSold: item.monthSold || 0,
          repurchaseRate: item.repurchaseRate || "0%",
          minOrderQuantity: item.minOrderQuantity || 1,
          tradeScore: item.tradeScore || "0",
          url: item.promotionURL || `https://detail.1688.com/offer/${item.offerId}.html`,
          sellerIdentities: item.sellerIdentities || [],
          offerIdentities: item.offerIdentities || [],
        })),
      };
    }),

  /**
   * Get product detail by offerId or URL
   */
  getProductDetail: protectedProcedure
    .input(z.object({
      offerIdOrUrl: z.string().min(1, "商品ID或链接不能为空"),
      country: z.string().default("zh"),
    }))
    .mutation(async ({ input }) => {
      const offerId = extractProductId(input.offerIdOrUrl);
      if (!offerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "无法识别商品ID，请输入1688商品链接或ID",
        });
      }
      
      const result = await call1688Api("product.search.queryProductDetail", {
        offerDetailParam: {
          offerId: Number(offerId),
          country: input.country,
        },
      });
      
      if (!result.result?.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.result?.message || "获取商品详情失败",
        });
      }
      
      const product = result.result.result;
      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "商品不存在",
        });
      }
      
      // Extract price from SKU info or sale info
      let price = "0";
      if (product.productSaleInfo?.priceRanges?.length > 0) {
        price = product.productSaleInfo.priceRanges[0].price || "0";
      } else if (product.productSkuInfos?.length > 0) {
        const firstSku = product.productSkuInfos[0];
        price = firstSku.price || firstSku.consignPrice || "0";
      }
      
      // Extract images
      const images: string[] = [];
      if (product.productImage?.images) {
        images.push(...product.productImage.images);
      }
      
      // Extract attributes
      const attributes: { name: string; value: string }[] = [];
      if (product.productAttribute?.length > 0) {
        for (const attr of product.productAttribute) {
          attributes.push({
            name: attr.attributeName || attr.name || "",
            value: attr.value || "",
          });
        }
      }
      
      return {
        offerId: String(product.offerId),
        title: product.subject,
        titleTranslated: product.subjectTrans,
        description: product.description,
        price,
        images,
        mainImage: images[0] || "",
        attributes,
        categoryId: product.categoryId,
        minOrderQuantity: product.minOrderQuantity || 1,
        status: product.status,
        companyName: product.companyName,
        url: product.promotionUrl || `https://detail.1688.com/offer/${product.offerId}.html`,
        skuInfo: product.productSkuInfos || [],
        shippingInfo: product.productShippingInfo || null,
        sellerInfo: product.sellerDataInfo || null,
      };
    }),

  /**
   * Get product sales trend data
   */
  getProductSalesTrend: protectedProcedure
    .input(z.object({
      offerId: z.string().min(1),
      startDate: z.string(), // format: YYYYMMDD
      endDate: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await call1688Api("product.analyze.getPerdaySellQuantityTrend", {
        offerId: input.offerId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      
      return result.result || { success: false, message: "获取销售趋势失败" };
    }),
});
