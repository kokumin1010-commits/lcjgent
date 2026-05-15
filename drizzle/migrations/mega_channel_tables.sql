-- メガチャンネル配信制度テーブル作成
-- 2026-05-15

-- 1. メガチャンネル設定テーブル
CREATE TABLE IF NOT EXISTS mega_channel_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tierName VARCHAR(50) NOT NULL DEFAULT 'Gold',
  hourlyRateThreshold INT NOT NULL DEFAULT 100000,
  recentLivestreamCount INT NOT NULL DEFAULT 3,
  channelName VARCHAR(255) DEFAULT 'Ryu kyogoku',
  channelDescription TEXT,
  channelFollowerCount INT,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  requireApproval BOOLEAN NOT NULL DEFAULT TRUE,
  maintenanceMonths INT DEFAULT 3,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. ライバーのメガチャンネル配信資格テーブル
CREATE TABLE IF NOT EXISTS mega_channel_qualifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  liverId INT NOT NULL,
  liverName VARCHAR(255) NOT NULL,
  status ENUM('not_qualified', 'qualified', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'not_qualified',
  avgHourlyRate INT DEFAULT 0,
  recentLivestreamCount INT DEFAULT 0,
  totalLivestreamCount INT DEFAULT 0,
  approvedAt TIMESTAMP NULL,
  approvedBy INT,
  rejectedAt TIMESTAMP NULL,
  rejectedReason TEXT,
  qualifiedAt TIMESTAMP NULL,
  suspendedAt TIMESTAMP NULL,
  consecutiveMonthsBelowThreshold INT DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_liverId (liverId)
);

-- 3. メガチャンネル資格変更履歴テーブル
CREATE TABLE IF NOT EXISTS mega_channel_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  liverId INT NOT NULL,
  liverName VARCHAR(255) NOT NULL,
  action ENUM('qualified', 'approved', 'rejected', 'suspended', 'restored') NOT NULL,
  previousStatus VARCHAR(50),
  newStatus VARCHAR(50) NOT NULL,
  avgHourlyRate INT,
  note TEXT,
  actionBy INT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_liverId (liverId),
  INDEX idx_action (action),
  INDEX idx_createdAt (createdAt)
);

-- 4. デフォルト設定を挿入
INSERT INTO mega_channel_settings (tierName, hourlyRateThreshold, recentLivestreamCount, channelName, channelDescription, isActive, requireApproval, maintenanceMonths)
VALUES ('Gold', 100000, 3, 'Ryu kyogoku', 'LCJが運営するフォロワー数万人規模のメガチャンネル。視聴者数が桁違いで、売上のポテンシャルが全く変わります。', TRUE, TRUE, 3)
ON DUPLICATE KEY UPDATE id = id;
