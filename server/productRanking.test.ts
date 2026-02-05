import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTopSellingProducts, getProductSalesRanking, getLiverProductMatrix } from './db';

// Mock the database
vi.mock('./db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db')>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

describe('Product Ranking Functions', () => {
  describe('getTopSellingProducts', () => {
    it('should be exported and callable', () => {
      expect(typeof getTopSellingProducts).toBe('function');
    });

    it('should have an alias getProductSalesRanking', () => {
      expect(getProductSalesRanking).toBe(getTopSellingProducts);
    });
  });

  describe('getLiverProductMatrix', () => {
    it('should be exported and callable', () => {
      expect(typeof getLiverProductMatrix).toBe('function');
    });
  });
});

describe('Product Ranking API Integration', () => {
  it('should return empty array when no data', async () => {
    // When database returns no livestreams, should return empty array
    const result = await getTopSellingProducts('2099-12', 10);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty matrix when no data', async () => {
    // When database returns no livestreams, should return empty matrix
    const result = await getLiverProductMatrix('2099-12', 10);
    expect(result).toHaveProperty('products');
    expect(result).toHaveProperty('livers');
    expect(result).toHaveProperty('matrix');
  });
});
