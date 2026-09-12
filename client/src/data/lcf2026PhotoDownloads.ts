/**
 * LCF 2026 official full-resolution photo archive.
 * Data rule: every public ZIP is immutable, independently checksummed, and contains no signed source-album URL.
 */
export type LcfPhotoDownloadChunk = {
  chunk: string;
  label: string;
  category: "day1" | "awards" | "day2";
  photoCount: number;
  zipBytes: number;
  zipSha256: string;
  downloadUrl: string;
};

export const lcf2026PhotoDownloadChunks: LcfPhotoDownloadChunk[] = [
  { chunk: "day1-001-100", label: "DAY1 原図 001–100", category: "day1", photoCount: 100, zipBytes: 683555980, zipSha256: "463ead2385006b094b4e9dfe438d54224d197909f05043af941e1fdd1aa18566", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/DyxqRdAppDWcuTtP.zip" },
  { chunk: "day1-101-200", label: "DAY1 原図 101–200", category: "day1", photoCount: 100, zipBytes: 696026297, zipSha256: "17d47d45d49e93162ce669736bedef569b2ccb1e2bd524ecc3064a21d84d2a25", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/wEIRfwRYUVRpFmos.zip" },
  { chunk: "day1-201-300", label: "DAY1 原図 201–300", category: "day1", photoCount: 100, zipBytes: 666943533, zipSha256: "1d6e379919fdadd89e2d18e6ee6d343469ce4d260e53049371526c63a778d40f", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/OLvJfhOeztbWeuVU.zip" },
  { chunk: "awards-001-062", label: "表彰式・アフターパーティー 原図 001–062", category: "awards", photoCount: 62, zipBytes: 400639155, zipSha256: "d5d6204b1777c8ae43793b52b4183aa89023b7ffcb84774e593a4c411af86ffe", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/lPRiPimKhOwUgAVg.zip" },
  { chunk: "awards-063-123", label: "表彰式・アフターパーティー 原図 063–123", category: "awards", photoCount: 61, zipBytes: 410085673, zipSha256: "136cb262f260294f04c0e48b3c3bf92c850f5d29ea7fd4df97632efbfd4840ce", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/dVZCZKRURYjeLAHD.zip" },
  { chunk: "day2-001-094", label: "DAY2 原図 001–094", category: "day2", photoCount: 94, zipBytes: 404810337, zipSha256: "66991fd693825d8d7e10201e0e854531441d7575d8df12f4fb6304442d753fa2", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/eSqVmtAfnYsYYuOV.zip" },
  { chunk: "day2-095-188", label: "DAY2 原図 095–188", category: "day2", photoCount: 94, zipBytes: 411896961, zipSha256: "c0aa19f4fdf34511ef6d9e9b62fbd26dca4dfac5fbd331f79ebd3921529003e7", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/LHqarkRyzqtdWAUO.zip" },
  { chunk: "day2-189-282", label: "DAY2 原図 189–282", category: "day2", photoCount: 94, zipBytes: 425616317, zipSha256: "76d9c56872e9dd4d49e84a5b85ea695b0dd458c02ce75b9f89d18f974553005f", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/FPGQZJDcNeMnPhUg.zip" },
  { chunk: "day2-283-375", label: "DAY2 原図 283–375", category: "day2", photoCount: 93, zipBytes: 400015231, zipSha256: "efa97639bb1932861ecf2095916679e9f5a40a41bce549da71cb8459d140e7bb", downloadUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/ExoMnFzuSeUGsHKw.zip" },
];

export const lcf2026PhotoArchive = {
  photoCount: 798,
  totalBytes: 4499589484,
  sourceAlbumUrl: "https://alltuu.cc/album/e977fc4e6ef93a44477c4294546fadb8/?from=qrCode&menu=live",
  manifestUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/eRQTEjKzHnwRZhfF.json",
  checksumUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/sdLSFtYkpFUQJZKD.txt",
  readmeUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/fVYXzGGYMWGZmazu.txt",
} as const;

export const formatArchiveSize = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
