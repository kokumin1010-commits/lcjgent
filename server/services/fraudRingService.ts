/**
 * Fraud Ring Detection & Management Service
 * 
 * Detects clusters of connected suspicious users/receipts and manages
 * fraud rings with labeling, rule application, and trust level adjustment.
 * 
 * Ring detection sources:
 * 1. Same image (phash similarity) across different users
 * 2. Same order number across different users
 * 
 * Ring management:
 * - suspected: Auto-detected, needs review
 * - confirmed: Admin-confirmed fraud ring
 * - dismissed: False positive, dismissed by admin
 */

import { getDb } from "../db";
import {
  fraudRings,
  fraudRingMembers,
  fraudRingEvidence,
  userTrustLevels,
  lineReceipts,
  imagePerceptualHashes,
  lineUsers,
} from "../../drizzle/schema";
import { eq, and, ne, inArray, or, sql, desc, asc, count } from "drizzle-orm";
import { findImageHashClusters, PHASH_SIMILARITY_THRESHOLD } from "./imageHashService";

// ============================================================
// Ring Detection
// ============================================================

interface RingConnection {
  receiptId1: number;
  lineUserId1: string;
  receiptId2: number;
  lineUserId2: string;
  type: "same_image" | "same_order";
  detail: string; // phash distance or order number
}

/**
 * Scan for cross-user duplicate order numbers
 */
async function findCrossUserOrderDuplicates(): Promise<RingConnection[]> {
  const db = await getDb();
  if (!db) return [];

  // Get all receipts with order numbers (approved, pending, on_hold)
  const receipts = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      ocrRawText: lineReceipts.ocrRawText,
      status: lineReceipts.status,
    })
    .from(lineReceipts)
    .where(
      or(
        eq(lineReceipts.status, "approved"),
        eq(lineReceipts.status, "pending"),
        eq(lineReceipts.status, "on_hold")
      )
    );

  // Build order number → receipts map
  const orderMap = new Map<string, Array<{ id: number; lineUserId: string }>>();
  for (const r of receipts) {
    try {
      const ocr = typeof r.ocrRawText === "string" ? JSON.parse(r.ocrRawText) : r.ocrRawText;
      const orderNum = String(ocr?.orderNumber || "").trim();
      if (orderNum && orderNum !== "null" && orderNum.length >= 5) {
        if (!orderMap.has(orderNum)) orderMap.set(orderNum, []);
        orderMap.get(orderNum)!.push({ id: r.id, lineUserId: r.lineUserId });
      }
    } catch { /* skip */ }
  }

  const connections: RingConnection[] = [];

  for (const [orderNum, recs] of orderMap) {
    // Group by user
    const userGroups = new Map<string, number[]>();
    for (const r of recs) {
      if (!userGroups.has(r.lineUserId)) userGroups.set(r.lineUserId, []);
      userGroups.get(r.lineUserId)!.push(r.id);
    }

    // Only interested in cross-user duplicates
    if (userGroups.size < 2) continue;

    const users = Array.from(userGroups.entries());
    for (let i = 0; i < users.length; i++) {
      for (let j = i + 1; j < users.length; j++) {
        connections.push({
          receiptId1: users[i][1][0], // First receipt from user i
          lineUserId1: users[i][0],
          receiptId2: users[j][1][0], // First receipt from user j
          lineUserId2: users[j][0],
          type: "same_order",
          detail: orderNum,
        });
      }
    }
  }

  return connections;
}

/**
 * Scan for cross-user image hash similarities
 */
async function findCrossUserImageDuplicates(): Promise<RingConnection[]> {
  const clusters = await findImageHashClusters(PHASH_SIMILARITY_THRESHOLD);

  // Filter to cross-user only
  return clusters
    .filter(c => c.hash1LineUserId !== c.hash2LineUserId)
    .map(c => ({
      receiptId1: c.hash1ReceiptId,
      lineUserId1: c.hash1LineUserId,
      receiptId2: c.hash2ReceiptId,
      lineUserId2: c.hash2LineUserId,
      type: "same_image" as const,
      detail: `phash_distance=${c.distance}`,
    }));
}

// ============================================================
// Union-Find for clustering
// ============================================================

class UnionFind {
  parent: Map<string, string>;
  rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }

  union(x: string, y: string): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx === ry) return;
    const rankX = this.rank.get(rx) || 0;
    const rankY = this.rank.get(ry) || 0;
    if (rankX < rankY) {
      this.parent.set(rx, ry);
    } else if (rankX > rankY) {
      this.parent.set(ry, rx);
    } else {
      this.parent.set(ry, rx);
      this.rank.set(rx, rankX + 1);
    }
  }

  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root)!.push(key);
    }
    return clusters;
  }
}

// ============================================================
// Ring Building
// ============================================================

interface DetectedRing {
  members: string[]; // lineUserIds
  connections: RingConnection[];
  connectionType: "same_image" | "same_order" | "mixed";
  hubUserId: string; // User with most connections
}

/**
 * Build fraud rings from connections using Union-Find clustering
 */
function buildRingsFromConnections(connections: RingConnection[]): DetectedRing[] {
  if (connections.length === 0) return [];

  const uf = new UnionFind();
  const userConnections = new Map<string, RingConnection[]>();

  for (const conn of connections) {
    uf.union(conn.lineUserId1, conn.lineUserId2);

    // Track connections per user
    if (!userConnections.has(conn.lineUserId1)) userConnections.set(conn.lineUserId1, []);
    if (!userConnections.has(conn.lineUserId2)) userConnections.set(conn.lineUserId2, []);
    userConnections.get(conn.lineUserId1)!.push(conn);
    userConnections.get(conn.lineUserId2)!.push(conn);
  }

  const clusters = uf.getClusters();
  const rings: DetectedRing[] = [];

  for (const [, members] of clusters) {
    if (members.length < 2) continue; // Need at least 2 users for a ring

    // Get connections for this cluster
    const clusterConnections = connections.filter(
      c => members.includes(c.lineUserId1) && members.includes(c.lineUserId2)
    );

    // Determine connection type
    const hasImage = clusterConnections.some(c => c.type === "same_image");
    const hasOrder = clusterConnections.some(c => c.type === "same_order");
    const connectionType = hasImage && hasOrder ? "mixed" : hasImage ? "same_image" : "same_order";

    // Find hub user (most connections)
    let hubUserId = members[0];
    let maxConnections = 0;
    for (const member of members) {
      const connCount = (userConnections.get(member) || []).filter(
        c => members.includes(c.lineUserId1) && members.includes(c.lineUserId2)
      ).length;
      if (connCount > maxConnections) {
        maxConnections = connCount;
        hubUserId = member;
      }
    }

    rings.push({
      members,
      connections: clusterConnections,
      connectionType,
      hubUserId,
    });
  }

  // Sort by member count (largest first)
  rings.sort((a, b) => b.members.length - a.members.length);

  return rings;
}

// ============================================================
// Ring Persistence
// ============================================================

/**
 * Generate a unique ring label
 */
function generateRingLabel(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RING-${year}${month}-${random}`;
}

/**
 * Save a detected ring to the database
 */
async function saveRing(ring: DetectedRing): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Get display names for members
  const userRecords = await db
    .select({ lineUserId: lineUsers.lineUserId, displayName: lineUsers.displayName })
    .from(lineUsers)
    .where(inArray(lineUsers.lineUserId, ring.members));

  const displayNameMap = new Map(userRecords.map(u => [u.lineUserId, u.displayName]));

  // Count receipts per member
  const receiptCounts = await db
    .select({
      lineUserId: lineReceipts.lineUserId,
      count: count(),
    })
    .from(lineReceipts)
    .where(inArray(lineReceipts.lineUserId, ring.members))
    .groupBy(lineReceipts.lineUserId);

  const receiptCountMap = new Map(receiptCounts.map(r => [r.lineUserId, r.count]));

  // Create ring
  const ringLabel = generateRingLabel();
  const [insertResult] = await db.insert(fraudRings).values({
    ringLabel,
    status: "suspected",
    memberCount: ring.members.length,
    receiptCount: ring.connections.length,
    connectionType: ring.connectionType,
    hubLineUserId: ring.hubUserId,
    hubDisplayName: displayNameMap.get(ring.hubUserId) || null,
  });

  const ringId = (insertResult as any).insertId;
  if (!ringId) return null;

  // Create members
  for (const member of ring.members) {
    const isHub = member === ring.hubUserId;
    const memberConnections = ring.connections.filter(
      c => c.lineUserId1 === member || c.lineUserId2 === member
    );
    const connectionReason = isHub
      ? "hub"
      : memberConnections[0]?.type === "same_image"
        ? "same_image"
        : "same_order";

    await db.insert(fraudRingMembers).values({
      ringId,
      lineUserId: member,
      displayName: displayNameMap.get(member) || null,
      connectionReason,
      receiptCount: receiptCountMap.get(member) || 0,
    });
  }

  // Create evidence records
  for (const conn of ring.connections) {
    await db.insert(fraudRingEvidence).values({
      ringId,
      receiptId1: conn.receiptId1,
      lineUserId1: conn.lineUserId1,
      receiptId2: conn.receiptId2,
      lineUserId2: conn.lineUserId2,
      evidenceType: conn.type,
      phashDistance: conn.type === "same_image" ? parseInt(conn.detail.replace("phash_distance=", "")) || null : null,
      orderNumber: conn.type === "same_order" ? conn.detail : null,
    });
  }

  return ringId;
}

// ============================================================
// Public API
// ============================================================

/**
 * Run full fraud ring detection scan
 * Finds all cross-user connections and builds rings
 */
export async function detectFraudRings(options: {
  includeImageDuplicates?: boolean;
  includeOrderDuplicates?: boolean;
  saveToDb?: boolean;
} = {}): Promise<{
  rings: DetectedRing[];
  savedRingIds: number[];
  stats: {
    totalConnections: number;
    imageConnections: number;
    orderConnections: number;
    totalRings: number;
    totalMembers: number;
  };
}> {
  const {
    includeImageDuplicates = true,
    includeOrderDuplicates = true,
    saveToDb = false,
  } = options;

  const allConnections: RingConnection[] = [];

  if (includeOrderDuplicates) {
    console.log("[FraudRing] Scanning cross-user order duplicates...");
    const orderConns = await findCrossUserOrderDuplicates();
    console.log(`[FraudRing] Found ${orderConns.length} cross-user order connections`);
    allConnections.push(...orderConns);
  }

  if (includeImageDuplicates) {
    console.log("[FraudRing] Scanning cross-user image duplicates...");
    const imageConns = await findCrossUserImageDuplicates();
    console.log(`[FraudRing] Found ${imageConns.length} cross-user image connections`);
    allConnections.push(...imageConns);
  }

  // Build rings
  const rings = buildRingsFromConnections(allConnections);
  console.log(`[FraudRing] Detected ${rings.length} fraud rings`);

  // Save to DB if requested
  const savedRingIds: number[] = [];
  if (saveToDb) {
    for (const ring of rings) {
      const ringId = await saveRing(ring);
      if (ringId) savedRingIds.push(ringId);
    }
    console.log(`[FraudRing] Saved ${savedRingIds.length} rings to database`);
  }

  return {
    rings,
    savedRingIds,
    stats: {
      totalConnections: allConnections.length,
      imageConnections: allConnections.filter(c => c.type === "same_image").length,
      orderConnections: allConnections.filter(c => c.type === "same_order").length,
      totalRings: rings.length,
      totalMembers: rings.reduce((sum, r) => sum + r.members.length, 0),
    },
  };
}

/**
 * Get all fraud rings with summary info
 */
export async function getFraudRings(params: {
  status?: "suspected" | "confirmed" | "dismissed";
  limit?: number;
  offset?: number;
} = {}): Promise<{
  rings: any[];
  total: number;
}> {
  const db = await getDb();
  if (!db) return { rings: [], total: 0 };

  const conditions = [];
  if (params.status) {
    conditions.push(eq(fraudRings.status, params.status));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(fraudRings)
    .where(whereClause);

  const rings = await db
    .select()
    .from(fraudRings)
    .where(whereClause)
    .orderBy(desc(fraudRings.createdAt))
    .limit(params.limit || 50)
    .offset(params.offset || 0);

  return {
    rings,
    total: totalResult?.count || 0,
  };
}

/**
 * Get fraud ring details including members and evidence
 */
export async function getFraudRingDetails(ringId: number): Promise<{
  ring: any;
  members: any[];
  evidence: any[];
} | null> {
  const db = await getDb();
  if (!db) return null;

  const [ring] = await db
    .select()
    .from(fraudRings)
    .where(eq(fraudRings.id, ringId));

  if (!ring) return null;

  const members = await db
    .select()
    .from(fraudRingMembers)
    .where(eq(fraudRingMembers.ringId, ringId));

  const evidence = await db
    .select()
    .from(fraudRingEvidence)
    .where(eq(fraudRingEvidence.ringId, ringId));

  return { ring, members, evidence };
}

/**
 * Update fraud ring status
 */
export async function updateFraudRingStatus(
  ringId: number,
  status: "suspected" | "confirmed" | "dismissed",
  adminUserId?: number,
  notes?: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(fraudRings)
    .set({
      status,
      confirmedBy: adminUserId || null,
      confirmedAt: status === "confirmed" ? new Date() : null,
      notes: notes || null,
    })
    .where(eq(fraudRings.id, ringId));

  // If confirmed, update trust levels for all members
  if (status === "confirmed") {
    const members = await db
      .select({ lineUserId: fraudRingMembers.lineUserId })
      .from(fraudRingMembers)
      .where(eq(fraudRingMembers.ringId, ringId));

    for (const member of members) {
      await adjustUserTrustLevel(member.lineUserId, "ring_confirmed");
    }
  }

  return true;
}

// ============================================================
// Trust Level Management
// ============================================================

/**
 * Calculate and update user trust level based on their history
 * 
 * Trust levels:
 * 1 = Highest trust (relaxed review) - clean history, many approved receipts
 * 2 = Good trust
 * 3 = Normal (default)
 * 4 = Low trust - some flags
 * 5 = Lowest trust (strict review) - confirmed fraud ring member
 */
export async function adjustUserTrustLevel(
  lineUserId: string,
  trigger: "ring_confirmed" | "ring_dismissed" | "receipt_approved" | "receipt_rejected" | "recalculate"
): Promise<number> {
  const db = await getDb();
  if (!db) return 3;

  // Get current trust level
  const [existing] = await db
    .select()
    .from(userTrustLevels)
    .where(eq(userTrustLevels.lineUserId, lineUserId));

  // Don't override manual overrides
  if (existing?.manualOverride) return existing.trustLevel;

  // Count ring memberships
  const [ringCount] = await db
    .select({ count: count() })
    .from(fraudRingMembers)
    .where(eq(fraudRingMembers.lineUserId, lineUserId));

  // Count confirmed fraud rings
  const confirmedRings = await db
    .select({ ringId: fraudRingMembers.ringId })
    .from(fraudRingMembers)
    .innerJoin(fraudRings, eq(fraudRingMembers.ringId, fraudRings.id))
    .where(
      and(
        eq(fraudRingMembers.lineUserId, lineUserId),
        eq(fraudRings.status, "confirmed")
      )
    );

  // Count approved/rejected receipts
  const [approvedCount] = await db
    .select({ count: count() })
    .from(lineReceipts)
    .where(and(eq(lineReceipts.lineUserId, lineUserId), eq(lineReceipts.status, "approved")));

  const [rejectedCount] = await db
    .select({ count: count() })
    .from(lineReceipts)
    .where(and(eq(lineReceipts.lineUserId, lineUserId), eq(lineReceipts.status, "rejected")));

  // Calculate trust level
  let trustLevel = 3; // Default: normal

  if (confirmedRings.length > 0) {
    trustLevel = 5; // Confirmed fraud ring member → lowest trust
  } else if ((ringCount?.count || 0) > 0) {
    trustLevel = 4; // Suspected ring member → low trust
  } else if ((rejectedCount?.count || 0) > 2) {
    trustLevel = 4; // Multiple rejections → low trust
  } else if ((approvedCount?.count || 0) >= 10 && (rejectedCount?.count || 0) === 0) {
    trustLevel = 1; // Many approvals, no rejections → highest trust
  } else if ((approvedCount?.count || 0) >= 5 && (rejectedCount?.count || 0) === 0) {
    trustLevel = 2; // Good history → good trust
  }

  // Upsert trust level
  if (existing) {
    await db
      .update(userTrustLevels)
      .set({
        trustLevel,
        ringMembershipCount: ringCount?.count || 0,
        confirmedFraudCount: confirmedRings.length,
        totalApprovedReceipts: approvedCount?.count || 0,
        totalRejectedReceipts: rejectedCount?.count || 0,
        lastCalculatedAt: new Date(),
      })
      .where(eq(userTrustLevels.lineUserId, lineUserId));
  } else {
    await db.insert(userTrustLevels).values({
      lineUserId,
      trustLevel,
      ringMembershipCount: ringCount?.count || 0,
      confirmedFraudCount: confirmedRings.length,
      totalApprovedReceipts: approvedCount?.count || 0,
      totalRejectedReceipts: rejectedCount?.count || 0,
      lastCalculatedAt: new Date(),
    });
  }

  return trustLevel;
}

/**
 * Get user trust level
 */
export async function getUserTrustLevel(lineUserId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 3;

  const [result] = await db
    .select({ trustLevel: userTrustLevels.trustLevel })
    .from(userTrustLevels)
    .where(eq(userTrustLevels.lineUserId, lineUserId));

  return result?.trustLevel || 3;
}

/**
 * Manually override user trust level
 */
export async function setManualTrustLevel(
  lineUserId: string,
  trustLevel: number,
  adminUserId: number,
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const [existing] = await db
    .select()
    .from(userTrustLevels)
    .where(eq(userTrustLevels.lineUserId, lineUserId));

  if (existing) {
    await db
      .update(userTrustLevels)
      .set({
        trustLevel,
        manualOverride: true,
        overrideBy: adminUserId,
        overrideReason: reason,
        lastCalculatedAt: new Date(),
      })
      .where(eq(userTrustLevels.lineUserId, lineUserId));
  } else {
    await db.insert(userTrustLevels).values({
      lineUserId,
      trustLevel,
      manualOverride: true,
      overrideBy: adminUserId,
      overrideReason: reason,
      lastCalculatedAt: new Date(),
    });
  }
}

/**
 * Get fraud ring dashboard statistics
 */
export async function getFraudRingDashboardStats(): Promise<{
  totalRings: number;
  suspectedRings: number;
  confirmedRings: number;
  dismissedRings: number;
  totalMembers: number;
  topHubs: Array<{
    lineUserId: string;
    displayName: string | null;
    ringCount: number;
    connectionCount: number;
  }>;
  recentRings: any[];
}> {
  const db = await getDb();
  if (!db) return {
    totalRings: 0, suspectedRings: 0, confirmedRings: 0, dismissedRings: 0,
    totalMembers: 0, topHubs: [], recentRings: [],
  };

  // Ring counts by status
  const statusCounts = await db
    .select({
      status: fraudRings.status,
      count: count(),
    })
    .from(fraudRings)
    .groupBy(fraudRings.status);

  const statusMap = new Map(statusCounts.map(s => [s.status, s.count]));

  // Total unique members
  const [memberCount] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${fraudRingMembers.lineUserId})` })
    .from(fraudRingMembers);

  // Top hubs (users in most rings)
  const topHubs = await db
    .select({
      lineUserId: fraudRingMembers.lineUserId,
      displayName: fraudRingMembers.displayName,
      ringCount: count(),
    })
    .from(fraudRingMembers)
    .groupBy(fraudRingMembers.lineUserId, fraudRingMembers.displayName)
    .orderBy(desc(count()))
    .limit(10);

  // Recent rings
  const recentRings = await db
    .select()
    .from(fraudRings)
    .orderBy(desc(fraudRings.createdAt))
    .limit(5);

  return {
    totalRings: (statusMap.get("suspected") || 0) + (statusMap.get("confirmed") || 0) + (statusMap.get("dismissed") || 0),
    suspectedRings: statusMap.get("suspected") || 0,
    confirmedRings: statusMap.get("confirmed") || 0,
    dismissedRings: statusMap.get("dismissed") || 0,
    totalMembers: memberCount?.count || 0,
    topHubs: topHubs.map(h => ({
      lineUserId: h.lineUserId,
      displayName: h.displayName,
      ringCount: h.ringCount,
      connectionCount: 0, // Will be enriched later
    })),
    recentRings,
  };
}
