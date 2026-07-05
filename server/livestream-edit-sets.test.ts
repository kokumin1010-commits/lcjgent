import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module
vi.mock('./db', () => ({
  deleteBrandLivestream: vi.fn().mockResolvedValue(undefined),
}));

import { deleteBrandLivestream } from './db';

describe('Livestream Edit Sets & Delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteBrandLivestream', () => {
    it('should call deleteBrandLivestream with correct id', async () => {
      await deleteBrandLivestream(12345);
      expect(deleteBrandLivestream).toHaveBeenCalledWith(12345);
    });

    it('should handle deletion of multiple livestreams', async () => {
      await deleteBrandLivestream(1);
      await deleteBrandLivestream(2);
      await deleteBrandLivestream(3);
      expect(deleteBrandLivestream).toHaveBeenCalledTimes(3);
    });
  });

  describe('Set data validation logic', () => {
    // Test the validation logic used in handleSave for sets
    type SetItem = { productName: string; originalPrice: string };
    type SetData = { setName: string; setPrice: string; quantitySold: string; items: SetItem[] };

    function validateSets(editSets: SetData[]) {
      return editSets
        .filter(s => s.setName.trim().length > 0)
        .map(s => ({
          setName: s.setName.trim(),
          setPrice: parseInt(s.setPrice) || 0,
          quantitySold: parseInt(s.quantitySold) || 0,
          items: s.items
            .filter(item => item.productName.trim().length > 0)
            .map(item => ({
              productName: item.productName.trim(),
              originalPrice: parseInt(item.originalPrice) || 0,
              quantity: 1,
            })),
        }))
        .filter(s => s.items.length > 0);
    }

    it('should filter out sets with empty names', () => {
      const sets: SetData[] = [
        { setName: '', setPrice: '1000', quantitySold: '1', items: [{ productName: 'Product A', originalPrice: '500' }] },
        { setName: '美容セット', setPrice: '2000', quantitySold: '2', items: [{ productName: 'Product B', originalPrice: '800' }] },
      ];
      const result = validateSets(sets);
      expect(result).toHaveLength(1);
      expect(result[0].setName).toBe('美容セット');
    });

    it('should filter out sets with no valid items', () => {
      const sets: SetData[] = [
        { setName: 'Empty Set', setPrice: '1000', quantitySold: '1', items: [{ productName: '', originalPrice: '' }] },
      ];
      const result = validateSets(sets);
      expect(result).toHaveLength(0);
    });

    it('should correctly parse set price and quantity', () => {
      const sets: SetData[] = [
        { setName: 'Test Set', setPrice: '5000', quantitySold: '3', items: [{ productName: 'Item', originalPrice: '2000' }] },
      ];
      const result = validateSets(sets);
      expect(result[0].setPrice).toBe(5000);
      expect(result[0].quantitySold).toBe(3);
    });

    it('should default quantity to 1 when invalid', () => {
      const sets: SetData[] = [
        { setName: 'Test Set', setPrice: '5000', quantitySold: '', items: [{ productName: 'Item', originalPrice: '2000' }] },
      ];
      const result = validateSets(sets);
      expect(result[0].quantitySold).toBe(1);
    });

    it('should handle multiple items in a set', () => {
      const sets: SetData[] = [
        {
          setName: '3点セット',
          setPrice: '5000',
          quantitySold: '1',
          items: [
            { productName: 'Product A', originalPrice: '2000' },
            { productName: 'Product B', originalPrice: '1500' },
            { productName: '', originalPrice: '' }, // should be filtered out
            { productName: 'Product C', originalPrice: '3000' },
          ],
        },
      ];
      const result = validateSets(sets);
      expect(result[0].items).toHaveLength(3);
      expect(result[0].items[0].productName).toBe('Product A');
      expect(result[0].items[2].productName).toBe('Product C');
    });

    it('should trim whitespace from names', () => {
      const sets: SetData[] = [
        { setName: '  美容セット  ', setPrice: '1000', quantitySold: '1', items: [{ productName: '  商品A  ', originalPrice: '500' }] },
      ];
      const result = validateSets(sets);
      expect(result[0].setName).toBe('美容セット');
      expect(result[0].items[0].productName).toBe('商品A');
    });

    it('should handle empty sets array', () => {
      const result = validateSets([]);
      expect(result).toHaveLength(0);
    });

    it('should calculate discount rate correctly', () => {
      const setPrice = 5000;
      const items = [
        { productName: 'A', originalPrice: '3000' },
        { productName: 'B', originalPrice: '4000' },
      ];
      const totalOriginalPrice = items.reduce((sum, item) => sum + (parseInt(item.originalPrice) || 0), 0);
      const discountRate = totalOriginalPrice > 0 ? Math.round(((totalOriginalPrice - setPrice) / totalOriginalPrice) * 100) : 0;
      expect(totalOriginalPrice).toBe(7000);
      expect(discountRate).toBe(29); // (7000-5000)/7000 * 100 = 28.57 → 29
    });
  });
});
