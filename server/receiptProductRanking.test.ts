import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractReceiptProducts,
  extractSingleReceiptProducts,
  getReceiptPurchaseRanking,
  getReceiptShopRanking,
  getReceiptProductsByShop,
} from './db';

// Mock the database module
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Receipt Product Extraction', () => {
  describe('extractReceiptProducts', () => {
    it('should be exported and callable', () => {
      expect(typeof extractReceiptProducts).toBe('function');
    });

    it('should return an object with extracted/skipped/errors counts', async () => {
      const result = await extractReceiptProducts();
      // When no new receipts to process, should return zero counts
      expect(result).toHaveProperty('extracted');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
      expect(typeof result.extracted).toBe('number');
      expect(typeof result.skipped).toBe('number');
      expect(typeof result.errors).toBe('number');
    }, 30000);
  });

  describe('extractSingleReceiptProducts', () => {
    it('should be exported and callable', () => {
      expect(typeof extractSingleReceiptProducts).toBe('function');
    });

    it('should handle non-existent receipt gracefully', async () => {
      // Should not throw for a non-existent receipt ID
      await expect(extractSingleReceiptProducts(999999)).resolves.not.toThrow();
    }, 15000);
  });
});

describe('Receipt Purchase Ranking Queries', () => {
  describe('getReceiptPurchaseRanking', () => {
    it('should be exported and callable', () => {
      expect(typeof getReceiptPurchaseRanking).toBe('function');
    });

    it('should return an array with expected fields', async () => {
      const result = await getReceiptPurchaseRanking(50);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty('productName');
        expect(item).toHaveProperty('shopName');
        expect(item).toHaveProperty('purchaseCount');
        expect(item).toHaveProperty('totalAmount');
        expect(item).toHaveProperty('uniqueBuyers');
        expect(typeof item.productName).toBe('string');
        expect(typeof item.purchaseCount).toBe('number');
      }
    }, 15000);

    it('should respect the limit parameter', async () => {
      const result = await getReceiptPurchaseRanking(3);
      expect(result.length).toBeLessThanOrEqual(3);
    }, 15000);

    it('should return results sorted by purchase count descending', async () => {
      const result = await getReceiptPurchaseRanking(50);
      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].purchaseCount).toBeGreaterThanOrEqual(result[i + 1].purchaseCount);
        }
      }
    }, 15000);
  });

  describe('getReceiptShopRanking', () => {
    it('should be exported and callable', () => {
      expect(typeof getReceiptShopRanking).toBe('function');
    });

    it('should return an array with expected fields', async () => {
      const result = await getReceiptShopRanking(30);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty('shopName');
        expect(item).toHaveProperty('purchaseCount');
        expect(item).toHaveProperty('totalAmount');
        expect(item).toHaveProperty('uniqueBuyers');
        expect(item).toHaveProperty('productCount');
      }
    }, 15000);

    it('should respect the limit parameter', async () => {
      const result = await getReceiptShopRanking(5);
      expect(result.length).toBeLessThanOrEqual(5);
    }, 15000);

    it('should return results sorted by total amount descending', async () => {
      const result = await getReceiptShopRanking(30);
      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(Number(result[i].totalAmount)).toBeGreaterThanOrEqual(Number(result[i + 1].totalAmount));
        }
      }
    }, 15000);
  });

  describe('getReceiptProductsByShop', () => {
    it('should be exported and callable', () => {
      expect(typeof getReceiptProductsByShop).toBe('function');
    });

    it('should return an array with expected fields for known shop', async () => {
      const result = await getReceiptProductsByShop('KYOGOKU JAPAN', 30);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        const item = result[0];
        expect(item).toHaveProperty('productName');
        expect(item).toHaveProperty('purchaseCount');
        expect(item).toHaveProperty('totalAmount');
        expect(item).toHaveProperty('uniqueBuyers');
      }
    }, 15000);

    it('should return empty array for non-existent shop', async () => {
      const result = await getReceiptProductsByShop('NON_EXISTENT_SHOP_12345', 30);
      expect(result).toEqual([]);
    }, 15000);

    it('should respect the limit parameter', async () => {
      const result = await getReceiptProductsByShop('KYOGOKU JAPAN', 2);
      expect(result.length).toBeLessThanOrEqual(2);
    }, 15000);
  });
});
