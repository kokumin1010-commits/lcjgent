import { describe, it, expect } from 'vitest';

describe('CSV Import Date Parsing', () => {
  // CSVの日時パースロジックをテスト
  const parseJstDateToUtc = (jstDateStr: string): Date => {
    // Use ISO 8601 format for reliable parsing across all environments
    // Convert "2025-08-31 06:00" to "2025-08-31T06:00:00+09:00"
    const isoFormat = jstDateStr.replace(' ', 'T') + ':00+09:00';
    return new Date(isoFormat);
  };

  it('should parse JST date string and convert to UTC correctly', () => {
    // CSV: 2025-08-31 06:00 (JST)
    // Expected UTC: 2025-08-30T21:00:00.000Z (JST - 9 hours)
    const jstDateStr = '2025-08-31 06:00';
    const result = parseJstDateToUtc(jstDateStr);
    
    expect(result.toISOString()).toBe('2025-08-30T21:00:00.000Z');
  });

  it('should parse JST date string at midnight correctly', () => {
    // CSV: 2025-08-31 00:00 (JST)
    // Expected UTC: 2025-08-30T15:00:00.000Z (JST - 9 hours)
    const jstDateStr = '2025-08-31 00:00';
    const result = parseJstDateToUtc(jstDateStr);
    
    expect(result.toISOString()).toBe('2025-08-30T15:00:00.000Z');
  });

  it('should parse JST date string in the evening correctly', () => {
    // CSV: 2025-08-30 20:00 (JST)
    // Expected UTC: 2025-08-30T11:00:00.000Z (JST - 9 hours)
    const jstDateStr = '2025-08-30 20:00';
    const result = parseJstDateToUtc(jstDateStr);
    
    expect(result.toISOString()).toBe('2025-08-30T11:00:00.000Z');
  });

  it('should handle date that crosses day boundary when converting to UTC', () => {
    // CSV: 2025-08-31 06:00 (JST)
    // When converted to UTC, it becomes 2025-08-30 (previous day)
    const jstDateStr = '2025-08-31 06:00';
    const result = parseJstDateToUtc(jstDateStr);
    
    // UTC date should be August 30, not August 31
    expect(result.getUTCDate()).toBe(30);
    expect(result.getUTCMonth()).toBe(7); // August is month 7 (0-indexed)
    expect(result.getUTCHours()).toBe(21);
  });

  it('should display correctly when converted back to JST', () => {
    // CSV: 2025-08-31 06:00 (JST)
    const jstDateStr = '2025-08-31 06:00';
    const utcDate = parseJstDateToUtc(jstDateStr);
    
    // When displayed in JST (UTC+9), should show 06:00
    const jstHours = utcDate.getUTCHours() + 9;
    const adjustedHours = jstHours >= 24 ? jstHours - 24 : jstHours;
    
    expect(adjustedHours).toBe(6);
  });
});
