import crypto from "node:crypto";
import mysql from "mysql2/promise";

const MARKER = "evidence-recovery-2026-08-25-v1";
const PAYLOAD_URL = "https://8765-ivj343oh3jtblj7srr0mk-b8eae7f6.sg1.manus.computer/payload/98565d84d36532f9ac76c36a825c1997643d9cd3d848eca3fd64e65090f98e4e";
const EXPECTED_SHA256 = "6ce8467d56d2df0a084c4f96e1a808bbf9b3d629465194d0d2853ce04ce7312a";
const ALLOWED_TABLES = new Set(["tasks", "blog_articles", "auto_post_logs", "ai_auto_review_logs"]);

type RecoveryPayload = {
  marker: string;
  tables: Record<string, Array<Record<string, unknown>>>;
};

function quoteIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

export async function applyEvidenceRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[EvidenceRecovery] DATABASE_URL is not set; skipping");
    return;
  }

  const connection = await mysql.createConnection(databaseUrl);
  try {
    await connection.execute(`CREATE TABLE IF NOT EXISTS \`_lcj_recovery_markers\` (
      \`marker\` varchar(128) NOT NULL,
      \`checksum\` char(64) NOT NULL,
      \`details\` json DEFAULT NULL,
      \`appliedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`marker\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [existing] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT marker FROM `_lcj_recovery_markers` WHERE marker = ? LIMIT 1",
      [MARKER],
    );
    if (existing.length > 0) {
      console.log(`[EvidenceRecovery] marker ${MARKER} already applied`);
      return;
    }

    console.log("[EvidenceRecovery] downloading verified one-time payload");
    const response = await fetch(PAYLOAD_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`payload download failed: HTTP ${response.status}`);
    }

    const raw = Buffer.from(await response.arrayBuffer());
    const actualSha256 = crypto.createHash("sha256").update(raw).digest("hex");
    if (actualSha256 !== EXPECTED_SHA256) {
      throw new Error(`payload checksum mismatch: ${actualSha256}`);
    }

    const payload = JSON.parse(raw.toString("utf8")) as RecoveryPayload;
    if (payload.marker !== MARKER || !payload.tables || typeof payload.tables !== "object") {
      throw new Error("invalid recovery payload");
    }

    await connection.beginTransaction();
    const counts: Record<string, number> = {};
    try {
      for (const [table, rows] of Object.entries(payload.tables)) {
        if (!ALLOWED_TABLES.has(table)) {
          throw new Error(`table not allowed in recovery payload: ${table}`);
        }
        let inserted = 0;
        for (const row of rows) {
          const columns = Object.keys(row);
          if (columns.length === 0) continue;
          const sql = `INSERT IGNORE INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
          const values = columns.map((column) => {
            const value = row[column];
            if (value !== null && typeof value === "object") return JSON.stringify(value);
            return value;
          });
          const [result] = await connection.execute<mysql.ResultSetHeader>(sql, values);
          inserted += result.affectedRows;
        }
        counts[table] = inserted;
      }

      await connection.execute(
        "INSERT INTO `_lcj_recovery_markers` (`marker`, `checksum`, `details`) VALUES (?, ?, ?)",
        [MARKER, EXPECTED_SHA256, JSON.stringify({ inserted: counts })],
      );
      await connection.commit();
      console.log(`[EvidenceRecovery] completed ${JSON.stringify(counts)}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}
