import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createContractLivestreamLink,
  getContractLivestreamLinks,
  getContractLinkedLivestreams,
  deleteContractLivestreamLink,
  deleteAllContractLivestreamLinks,
  checkContractLivestreamLinkExists,
  calculateContractRoas,
  createBrandContract,
  createBrandLivestream,
  createBrand,
  deleteBrandContract,
  deleteBrandLivestream,
  deleteBrand,
} from "./db";

describe("Contract-Livestream Link Functions", () => {
  let testBrandId: number;
  let testContractId: number;
  let testLivestreamId1: number;
  let testLivestreamId2: number;

  beforeAll(async () => {
    // Create test brand
    const brand = await createBrand({
      name: "Test Brand for Contract Link",
      nameJa: "テストブランド",
      category: "テスト",
      status: "進行中",
      createdBy: 1,
    });
    testBrandId = brand.id;

    // Create test contract
    const contract = await createBrandContract({
      brandId: testBrandId,
      serviceType: "ライブコマース",
      contractType: "月額契約",
      fixedFee: 1000000, // ¥1,000,000
      status: "契約中",
      createdBy: 1,
    });
    testContractId = contract.id;

    // Create test livestreams
    const livestream1 = await createBrandLivestream({
      brandId: testBrandId,
      livestreamDate: new Date("2025-01-15"),
      streamerName: "Test Streamer 1",
      platform: "TikTok",
      gmv: 5000000, // ¥5,000,000
      impressions: 100000, // 100,000 impressions
      createdBy: 1,
    });
    testLivestreamId1 = livestream1.id;

    const livestream2 = await createBrandLivestream({
      brandId: testBrandId,
      livestreamDate: new Date("2025-01-20"),
      streamerName: "Test Streamer 2",
      platform: "Douyin",
      gmv: 3000000, // ¥3,000,000
      impressions: 50000, // 50,000 impressions
      createdBy: 1,
    });
    testLivestreamId2 = livestream2.id;
  });

  afterAll(async () => {
    // Clean up: delete all links first
    await deleteAllContractLivestreamLinks(testContractId);
    
    // Delete test data
    if (testLivestreamId1) await deleteBrandLivestream(testLivestreamId1);
    if (testLivestreamId2) await deleteBrandLivestream(testLivestreamId2);
    if (testContractId) await deleteBrandContract(testContractId);
    if (testBrandId) await deleteBrand(testBrandId);
  });

  it("should create a contract-livestream link", async () => {
    const link = await createContractLivestreamLink({
      contractId: testContractId,
      livestreamId: testLivestreamId1,
      createdBy: 1,
    });

    expect(link).toBeDefined();
    expect(link.contractId).toBe(testContractId);
    expect(link.livestreamId).toBe(testLivestreamId1);
  });

  it("should check if link exists", async () => {
    const exists = await checkContractLivestreamLinkExists(testContractId, testLivestreamId1);
    expect(exists).toBe(true);

    const notExists = await checkContractLivestreamLinkExists(testContractId, 999999);
    expect(notExists).toBe(false);
  });

  it("should get contract livestream links", async () => {
    const links = await getContractLivestreamLinks(testContractId);
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links.some(l => l.livestreamId === testLivestreamId1)).toBe(true);
  });

  it("should get linked livestreams with details", async () => {
    const livestreams = await getContractLinkedLivestreams(testContractId);
    expect(livestreams.length).toBeGreaterThanOrEqual(1);
    
    const linkedLs = livestreams.find(ls => ls.id === testLivestreamId1);
    expect(linkedLs).toBeDefined();
    expect(linkedLs?.gmv).toBe(5000000);
    expect(linkedLs?.impressions).toBe(100000);
  });

  it("should add second livestream link", async () => {
    const link = await createContractLivestreamLink({
      contractId: testContractId,
      livestreamId: testLivestreamId2,
      createdBy: 1,
    });

    expect(link).toBeDefined();
    expect(link.livestreamId).toBe(testLivestreamId2);

    const links = await getContractLivestreamLinks(testContractId);
    expect(links.length).toBe(2);
  });

  it("should calculate contract ROAS correctly", async () => {
    // Fixed fee: ¥1,000,000
    // Livestream 1: GMV ¥5,000,000, Impressions 100,000
    // Livestream 2: GMV ¥3,000,000, Impressions 50,000
    // Total GMV: ¥8,000,000
    // Total Impressions: 150,000
    // Ad Value: 150,000 × ¥15 = ¥2,250,000
    // Total Value: ¥8,000,000 + ¥2,250,000 = ¥10,250,000
    // ROAS: (GMV + Ad Value) / Fixed Fee = ¥10,250,000 / ¥1,000,000 = 10.25

    const roasData = await calculateContractRoas(testContractId, 1000000);
    
    expect(roasData).toBeDefined();
    expect(roasData?.totalGmv).toBe(8000000);
    expect(roasData?.totalImpressions).toBe(150000);
    expect(roasData?.adValue).toBe(2250000); // 150,000 × 15
    expect(roasData?.totalValue).toBe(10250000);
    expect(roasData?.roas).toBeCloseTo(10.25, 2); // (GMV + Ad Value) / Fixed Fee
    expect(roasData?.livestreamCount).toBe(2);
  });

  it("should delete a specific link", async () => {
    await deleteContractLivestreamLink(testContractId, testLivestreamId1);
    
    const exists = await checkContractLivestreamLinkExists(testContractId, testLivestreamId1);
    expect(exists).toBe(false);

    const links = await getContractLivestreamLinks(testContractId);
    expect(links.length).toBe(1);
  });

  it("should delete all links for a contract", async () => {
    // Re-add the first link
    await createContractLivestreamLink({
      contractId: testContractId,
      livestreamId: testLivestreamId1,
      createdBy: 1,
    });

    // Delete all
    await deleteAllContractLivestreamLinks(testContractId);

    const links = await getContractLivestreamLinks(testContractId);
    expect(links.length).toBe(0);
  });

  it("should return zero ROAS when no links exist", async () => {
    const roasData = await calculateContractRoas(testContractId, 1000000);
    
    expect(roasData).toBeDefined();
    expect(roasData?.totalGmv).toBe(0);
    expect(roasData?.totalImpressions).toBe(0);
    expect(roasData?.adValue).toBe(0);
    expect(roasData?.roas).toBe(0);
    expect(roasData?.livestreamCount).toBe(0);
  });
});
