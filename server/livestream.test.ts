import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database functions
vi.mock('./db', () => ({
  createBrandLivestream: vi.fn(),
  getLivestreamsByBrandId: vi.fn(),
  updateBrandLivestream: vi.fn(),
}));

import { createBrandLivestream, getLivestreamsByBrandId, updateBrandLivestream } from './db';

describe('Brand Livestream Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBrandLivestream', () => {
    it('should create a livestream with all fields including startTime, productId, and productCommission', async () => {
      const mockLivestreamData = {
        brandId: 120001,
        livestreamDate: new Date('2025-01-24'),
        streamerName: '@testaccount',
        platform: 'TikTok',
        productId: 1,
        productCommission: '15%',
        livestreamStartTime: '14:30',
        gmv: 50000,
        createdBy: 1,
      };

      const mockResult = { id: 5, ...mockLivestreamData };
      vi.mocked(createBrandLivestream).mockResolvedValue(mockResult);

      const result = await createBrandLivestream(mockLivestreamData);

      expect(createBrandLivestream).toHaveBeenCalledWith(mockLivestreamData);
      expect(result).toEqual(mockResult);
      expect(result.productId).toBe(1);
      expect(result.productCommission).toBe('15%');
      expect(result.livestreamStartTime).toBe('14:30');
    });

    it('should create a livestream with null productId when no product is linked', async () => {
      const mockLivestreamData = {
        brandId: 120001,
        livestreamDate: new Date('2025-01-24'),
        streamerName: '@testaccount',
        platform: 'TikTok',
        productId: null,
        productCommission: null,
        livestreamStartTime: '20:00',
        gmv: 30000,
        createdBy: 1,
      };

      const mockResult = { id: 6, ...mockLivestreamData };
      vi.mocked(createBrandLivestream).mockResolvedValue(mockResult);

      const result = await createBrandLivestream(mockLivestreamData);

      expect(result.productId).toBeNull();
      expect(result.productCommission).toBeNull();
      expect(result.livestreamStartTime).toBe('20:00');
    });
  });

  describe('getLivestreamsByBrandId', () => {
    it('should return livestreams with productId, productCommission, and livestreamStartTime fields', async () => {
      const mockLivestreams = [
        {
          id: 1,
          brandId: 120001,
          livestreamDate: new Date('2025-01-24'),
          streamerName: '@account1',
          platform: 'TikTok',
          productId: 1,
          productCommission: '15%',
          livestreamStartTime: '14:30',
          gmv: 50000,
          productGmvTotal: 50000,
          productCount: 1,
        },
        {
          id: 2,
          brandId: 120001,
          livestreamDate: new Date('2025-01-23'),
          streamerName: '@account2',
          platform: 'Instagram',
          productId: null,
          productCommission: null,
          livestreamStartTime: null,
          gmv: 30000,
          productGmvTotal: 30000,
          productCount: 0,
        },
      ];

      vi.mocked(getLivestreamsByBrandId).mockResolvedValue(mockLivestreams);

      const result = await getLivestreamsByBrandId(120001);

      expect(getLivestreamsByBrandId).toHaveBeenCalledWith(120001);
      expect(result).toHaveLength(2);
      
      // First livestream should have all fields
      expect(result[0].productId).toBe(1);
      expect(result[0].productCommission).toBe('15%');
      expect(result[0].livestreamStartTime).toBe('14:30');
      
      // Second livestream should have null values
      expect(result[1].productId).toBeNull();
      expect(result[1].productCommission).toBeNull();
      expect(result[1].livestreamStartTime).toBeNull();
    });
  });

  describe('updateBrandLivestream', () => {
    it('should update livestream with productId, productCommission, and livestreamStartTime', async () => {
      const updateData = {
        productId: 2,
        productCommission: '20%',
        livestreamStartTime: '18:00',
      };

      vi.mocked(updateBrandLivestream).mockResolvedValue(undefined);

      await updateBrandLivestream(1, updateData);

      expect(updateBrandLivestream).toHaveBeenCalledWith(1, updateData);
    });

    it('should allow clearing productId by setting it to null', async () => {
      const updateData = {
        productId: null,
        productCommission: null,
      };

      vi.mocked(updateBrandLivestream).mockResolvedValue(undefined);

      await updateBrandLivestream(1, updateData);

      expect(updateBrandLivestream).toHaveBeenCalledWith(1, updateData);
    });
  });
});
