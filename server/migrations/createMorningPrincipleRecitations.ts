import { sql } from "drizzle-orm";

/**
 * 個人9条朗読記録テーブルを冪等に作成する。
 * 既存の morning_meetings（チーム朝会）には触れない。
 */
export async function createMorningPrincipleRecitations(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS morning_principle_recitations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date VARCHAR(10) NOT NULL,
      userId INT NOT NULL,
      userName VARCHAR(255) NOT NULL,
      userEmail VARCHAR(320) NOT NULL,
      staffId INT NULL,
      staffName VARCHAR(255) NULL,
      staffPosition VARCHAR(255) NULL,
      language VARCHAR(10) NOT NULL,
      audioUrl TEXT NOT NULL,
      audioKey VARCHAR(500) NOT NULL,
      mimeType VARCHAR(100) NOT NULL,
      durationSeconds INT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'completed',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_morning_principle_date_user (date, userId),
      INDEX idx_morning_principle_date (date),
      INDEX idx_morning_principle_staff (staffId)
    )
  `);
  console.log("[Migration] morning_principle_recitations table created/verified");
}
