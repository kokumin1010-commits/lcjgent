import { describe, expect, it } from 'vitest';
import { signRankingUploadReceipt, verifyRankingUploadReceipt } from './tiktokCompetitorUploadReceipt';

const secret='competitor-upload-test-secret-at-least-32-characters';
const receipt={
  date:'2026-08-28',
  fileSha256:'a'.repeat(64),
  fileSize:2048,
  fileKey:'tiktok-competitor-daily/rankings/2026-08-28/source.xlsx',
  rowsSha256:'c'.repeat(64),
};

describe('TikTok competitor upload receipt',()=>{
  it('accepts an untampered server-signed receipt',()=>{
    const uploadToken=signRankingUploadReceipt(receipt,secret);
    expect(verifyRankingUploadReceipt({...receipt,uploadToken},secret)).toBe(true);
  });

  it.each([
    ['date',{date:'2026-08-27'}],
    ['hash',{fileSha256:'b'.repeat(64)}],
    ['size',{fileSize:2049}],
    ['key',{fileKey:'tiktok-competitor-daily/rankings/2026-08-28/other.xlsx'}],
    ['parsed rows',{rowsSha256:'d'.repeat(64)}],
  ])('rejects a tampered %s',(_label,patch)=>{
    const uploadToken=signRankingUploadReceipt(receipt,secret);
    expect(verifyRankingUploadReceipt({...receipt,...patch,uploadToken},secret)).toBe(false);
  });

  it('rejects a tampered token and weak signing secrets',()=>{
    const uploadToken=signRankingUploadReceipt(receipt,secret);
    expect(verifyRankingUploadReceipt({...receipt,uploadToken:`${uploadToken.slice(0,-1)}x`},secret)).toBe(false);
    expect(()=>signRankingUploadReceipt(receipt,'short')).toThrow('at least 32');
  });
});
