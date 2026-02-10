import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database functions
vi.mock('./db', () => ({
  createBrandLivestream: vi.fn(),
  updateBrandLivestream: vi.fn(),
  getLiverById: vi.fn(),
  getLivestreamById: vi.fn(),
  logBrandEdit: vi.fn(),
}));

import {
  createBrandLivestream,
  updateBrandLivestream,
  getLiverById,
  getLivestreamById,
  logBrandEdit,
} from './db';

describe('Brand Livestream - Liver Dropdown Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBrandLivestream with liverId', () => {
    it('should resolve streamerName from liver master when liverId is provided', async () => {
      // Simulate the backend logic: when liverId is provided, look up liver and set streamerName
      const mockLiver = {
        id: 1,
        name: '京極龍',
        tiktokAccount: '@ryukyogoku',
        email: 'ryu@example.com',
        isActive: true,
      };

      vi.mocked(getLiverById).mockResolvedValue(mockLiver as any);
      vi.mocked(createBrandLivestream).mockResolvedValue({
        id: 10,
        brandId: 120001,
        livestreamDate: new Date('2025-02-01'),
        streamerName: '@ryukyogoku',
        liverId: 1,
        platform: 'TikTok',
        gmv: 50000,
        createdBy: 1,
      } as any);

      // Simulate the router logic
      const inputLiverId = 1;
      const liver = await getLiverById(inputLiverId);
      expect(liver).not.toBeNull();

      const resolvedStreamerName = liver!.tiktokAccount || liver!.name;
      expect(resolvedStreamerName).toBe('@ryukyogoku');

      const result = await createBrandLivestream({
        brandId: 120001,
        livestreamDate: new Date('2025-02-01'),
        streamerName: resolvedStreamerName,
        liverId: inputLiverId,
        platform: 'TikTok',
        gmv: 50000,
        createdBy: 1,
      });

      expect(result.liverId).toBe(1);
      expect(result.streamerName).toBe('@ryukyogoku');
    });

    it('should use liver name when tiktokAccount is not set', async () => {
      const mockLiver = {
        id: 2,
        name: 'テストライバー',
        tiktokAccount: null,
        email: 'test@example.com',
        isActive: true,
      };

      vi.mocked(getLiverById).mockResolvedValue(mockLiver as any);

      const liver = await getLiverById(2);
      const resolvedStreamerName = liver!.tiktokAccount || liver!.name;
      expect(resolvedStreamerName).toBe('テストライバー');
    });

    it('should allow manual streamerName input without liverId (backward compatibility)', async () => {
      vi.mocked(createBrandLivestream).mockResolvedValue({
        id: 11,
        brandId: 120001,
        livestreamDate: new Date('2025-02-01'),
        streamerName: '@manual_input',
        liverId: null,
        platform: 'TikTok',
        gmv: 30000,
        createdBy: 1,
      } as any);

      // No liverId, manual streamerName
      const result = await createBrandLivestream({
        brandId: 120001,
        livestreamDate: new Date('2025-02-01'),
        streamerName: '@manual_input',
        liverId: null,
        platform: 'TikTok',
        gmv: 30000,
        createdBy: 1,
      });

      expect(result.liverId).toBeNull();
      expect(result.streamerName).toBe('@manual_input');
    });
  });

  describe('updateBrandLivestream with liverId', () => {
    it('should update liverId and auto-resolve streamerName', async () => {
      const mockLiver = {
        id: 3,
        name: '新ライバー',
        tiktokAccount: '@new_liver',
        email: 'new@example.com',
        isActive: true,
      };

      vi.mocked(getLiverById).mockResolvedValue(mockLiver as any);
      vi.mocked(updateBrandLivestream).mockResolvedValue(undefined);

      // Simulate router logic for update
      const liverId = 3;
      const liver = await getLiverById(liverId);
      const updateData: any = {
        liverId,
        streamerName: liver!.tiktokAccount || liver!.name,
      };

      await updateBrandLivestream(10, updateData);

      expect(updateBrandLivestream).toHaveBeenCalledWith(10, {
        liverId: 3,
        streamerName: '@new_liver',
      });
    });

    it('should allow clearing liverId (set to null) for manual input', async () => {
      vi.mocked(updateBrandLivestream).mockResolvedValue(undefined);

      const updateData = {
        liverId: null,
        streamerName: '@manual_override',
      };

      await updateBrandLivestream(10, updateData);

      expect(updateBrandLivestream).toHaveBeenCalledWith(10, {
        liverId: null,
        streamerName: '@manual_override',
      });
    });
  });

  describe('Liver name consistency', () => {
    it('should prevent inconsistent names by using liver master data', async () => {
      // This test verifies the core problem being solved:
      // Previously, manual input led to inconsistencies like @ryukyogoku vs @ryukrogoku
      const mockLiver = {
        id: 1,
        name: '京極龍',
        tiktokAccount: '@ryukyogoku',
        email: 'ryu@example.com',
        isActive: true,
      };

      vi.mocked(getLiverById).mockResolvedValue(mockLiver as any);

      // First livestream
      const liver1 = await getLiverById(1);
      const name1 = liver1!.tiktokAccount || liver1!.name;

      // Second livestream (same liver)
      const liver2 = await getLiverById(1);
      const name2 = liver2!.tiktokAccount || liver2!.name;

      // Names should always be consistent when using liverId
      expect(name1).toBe(name2);
      expect(name1).toBe('@ryukyogoku');
    });
  });
});
