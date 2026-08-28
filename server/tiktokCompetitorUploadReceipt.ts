import { createHmac, timingSafeEqual } from 'node:crypto';

export type RankingUploadReceipt = {
  date: string;
  fileSha256: string;
  fileSize: number;
  fileKey: string;
  rowsSha256: string;
};

function receiptSecret(explicitSecret?: string) {
  const secret = explicitSecret ?? process.env.JWT_SECRET ?? '';
  if (secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
  return secret;
}

export function signRankingUploadReceipt(input: RankingUploadReceipt, explicitSecret?: string) {
  const payload = `${input.date}\n${input.fileSha256}\n${input.fileSize}\n${input.fileKey}\n${input.rowsSha256}`;
  return createHmac('sha256', receiptSecret(explicitSecret))
    .update(`tiktok-ranking-upload:v1:${payload}`)
    .digest('base64url');
}

export function verifyRankingUploadReceipt(input: RankingUploadReceipt & { uploadToken: string }, explicitSecret?: string) {
  const expected = Buffer.from(signRankingUploadReceipt(input, explicitSecret));
  const actual = Buffer.from(input.uploadToken);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
