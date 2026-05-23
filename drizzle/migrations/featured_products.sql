-- 今週の重点商品システム テーブル作成
-- 2026-05-24

-- 1. 重点商品テーブル（管理側が設定する商品情報）
CREATE TABLE IF NOT EXISTS featured_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  -- 商品情報
  tiktokShopUrl VARCHAR(500),
  productName VARCHAR(255) NOT NULL,
  productImageUrl VARCHAR(500),
  brandName VARCHAR(255),
  -- ノルマ設定
  quotaDurationMinutes INT NOT NULL DEFAULT 60,  -- ノルマ配信時間（分）
  -- 期間
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  -- 備考・告知情報
  notes TEXT,  -- セット組OK、割引○%OK等
  setProposal TEXT,  -- セット提案
  talkScript TEXT,  -- トークスクリプト
  successCase TEXT,  -- 成功事例
  -- 対象設定
  targetType ENUM('all', 'specific') NOT NULL DEFAULT 'all',  -- 全員 or 特定ライバー
  -- ステータス
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,  -- 表示優先度（高い方が上）
  -- メタ
  createdBy INT,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dates (startDate, endDate),
  INDEX idx_active (isActive)
);

-- 2. 重点商品の対象ライバー（targetType='specific'の場合）
CREATE TABLE IF NOT EXISTS featured_product_targets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  featuredProductId INT NOT NULL,
  liverId INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_product_liver (featuredProductId, liverId),
  INDEX idx_liverId (liverId)
);

-- 3. ライバーの確認記録（ポップアップ確認済み）
CREATE TABLE IF NOT EXISTS featured_product_acknowledgements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  featuredProductId INT NOT NULL,
  liverId INT NOT NULL,
  acknowledgedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_product_liver (featuredProductId, liverId),
  INDEX idx_liverId (liverId)
);

-- 4. ライバーのノルマ達成記録
CREATE TABLE IF NOT EXISTS featured_product_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  featuredProductId INT NOT NULL,
  liverId INT NOT NULL,
  -- 達成状況
  achievedDurationMinutes INT NOT NULL DEFAULT 0,  -- 達成した配信時間（分）
  livestreamCount INT NOT NULL DEFAULT 0,  -- 配信回数
  salesAmount INT NOT NULL DEFAULT 0,  -- 売上金額
  -- ステータス
  status ENUM('in_progress', 'completed', 'failed') NOT NULL DEFAULT 'in_progress',
  completedAt TIMESTAMP NULL,
  -- メタ
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_product_liver (featuredProductId, liverId),
  INDEX idx_liverId (liverId),
  INDEX idx_status (status)
);

-- 5. 未達成ペナルティ履歴
CREATE TABLE IF NOT EXISTS featured_product_penalties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  featuredProductId INT NOT NULL,
  liverId INT NOT NULL,
  liverName VARCHAR(255),
  -- ペナルティ詳細
  quotaDurationMinutes INT NOT NULL,  -- 設定されたノルマ
  achievedDurationMinutes INT NOT NULL DEFAULT 0,  -- 実際の達成時間
  achievementRate DECIMAL(5,2) NOT NULL DEFAULT 0,  -- 達成率（%）
  -- メタ
  penaltyDate DATE NOT NULL,  -- ペナルティ発生日（期限日）
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_liverId (liverId),
  INDEX idx_penaltyDate (penaltyDate)
);
