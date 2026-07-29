-- 招待ボーナスオファーテーブル作成
-- 2026-07-29
-- 確変チャンス完了後に24時間以内に友達1人招待で500ptボーナスを付与する仕組み

CREATE TABLE IF NOT EXISTS referral_bonus_offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lineUserId INT NOT NULL,
  campaignId INT NOT NULL,
  bonusPoints INT NOT NULL DEFAULT 500,
  status ENUM('active', 'claimed', 'expired') NOT NULL DEFAULT 'active',
  expiresAt TIMESTAMP NOT NULL,
  claimedAt TIMESTAMP NULL,
  claimedReferralId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_line_user_status (lineUserId, status),
  INDEX idx_expires (expiresAt)
);
